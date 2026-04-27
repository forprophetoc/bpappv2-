import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import bcrypt from "bcryptjs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getEstimateBySlug, getAdminUserByEmail, createAdminUser, getCompanyBySlug, upsertCompany } from "../db";
import { ENV } from "./env";
import { signAdminToken, getAdminSession, ADMIN_COOKIE_NAME } from "./adminAuth";
import { clearExpiredImages } from "../db";
import { registerStripeWebhookRoutes } from "./stripeWebhook";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Stripe webhook must be registered BEFORE express.json() — it needs express.raw()
  registerStripeWebhookRoutes(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Serve data URI images as binary responses
  app.get("/api/image/:slug/:field", (req, res) => {
    const { slug, field } = req.params;
    if (!["beforeUrl", "afterUrl"].includes(field)) { res.status(400).send("Invalid field"); return; }
    const estimate = getEstimateBySlug(slug);
    if (!estimate) { res.status(404).send("Not found"); return; }
    const url = (estimate as any)[field] as string;
    if (!url || !url.startsWith("data:")) { res.redirect(url || "/"); return; }
    const match = url.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) { res.status(400).send("Invalid data URI"); return; }
    const buffer = Buffer.from(match[2], "base64");
    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  });

  // ── Auth: Login with email + password ──
  app.post("/api/admin/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      res.status(401).json({ error: "Email and password required" });
      return;
    }

    const adminUser = getAdminUserByEmail(email.toLowerCase().trim());
    if (!adminUser) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, adminUser.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Look up the company for this user
    const { getCompanyById } = await import("../db");
    const company = getCompanyById(adminUser.companyId);
    if (!company) {
      res.status(500).json({ error: "Company not found" });
      return;
    }

    const token = await signAdminToken({
      admin: true,
      companyId: company.id,
      companySlug: company.slug,
      userId: adminUser.id,
      email: adminUser.email,
    });

    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: ENV.isProduction,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.json({ success: true, companySlug: company.slug });
  });

  app.get("/api/admin/check", async (req, res) => {
    const session = await getAdminSession(req as any);
    if (!session) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      companySlug: session.companySlug,
      email: session.email,
    });
  });

  app.post("/api/admin/logout", (_req, res) => {
    res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  // ── DEV ONLY: Test onboarding pipeline ──
  // Creates a test customer from the CustomerSetup form submission
  app.post("/api/dev/onboard", async (req, res) => {
    if (ENV.isProduction) {
      res.status(404).send("Not found");
      return;
    }

    const { config, adminEmail, adminPassword } = req.body || {};

    if (!config || !config.company?.slug || !config.company?.name) {
      res.status(400).json({ error: "Valid config with company.slug and company.name is required" });
      return;
    }
    if (!adminEmail || !adminPassword) {
      res.status(400).json({ error: "adminEmail and adminPassword are required" });
      return;
    }
    if (typeof adminPassword !== "string" || adminPassword.length < 4) {
      res.status(400).json({ error: "Password must be at least 4 characters" });
      return;
    }

    const slug = config.company.slug;

    try {
      // 1. Write config JSON to config/dev/{slug}.json
      const fs = await import("fs");
      const path = await import("path");
      const devDir = path.resolve(import.meta.dirname, "../../config/dev");
      if (!fs.existsSync(devDir)) {
        fs.mkdirSync(devDir, { recursive: true });
      }
      const configPath = path.join(devDir, `${slug}.json`);
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

      // 2. Register config in runtime registry
      const { registerConfig } = await import("../../config");
      registerConfig(slug, config);

      // 3. Create/upsert company in database
      const company = upsertCompany({ slug, name: config.company.name });
      if (!company) {
        res.status(500).json({ error: "Failed to create company" });
        return;
      }

      // 4. Create admin user (skip if already exists)
      const existingUser = getAdminUserByEmail(adminEmail.toLowerCase().trim());
      if (existingUser) {
        res.json({
          success: true,
          message: "Company config saved. Admin user already exists.",
          companySlug: slug,
          configPath: `config/dev/${slug}.json`,
          loginEmail: adminEmail.toLowerCase().trim(),
        });
        return;
      }

      const hashed = await bcrypt.hash(adminPassword, 12);
      const user = createAdminUser({
        email: adminEmail.toLowerCase().trim(),
        password: hashed,
        companyId: company.id,
      });

      res.json({
        success: true,
        message: "Test customer created successfully",
        companySlug: slug,
        companyId: company.id,
        adminUserId: user?.id,
        configPath: `config/dev/${slug}.json`,
        loginEmail: adminEmail.toLowerCase().trim(),
      });
    } catch (err: any) {
      console.error("[Dev Onboard] Error:", err);
      res.status(500).json({ error: err.message || "Failed to onboard test customer" });
    }
  });

  // ── Admin user registration (for initial setup / adding users) ──
  app.post("/api/admin/register", async (req, res) => {
    const { email, password, companySlug, setupKey } = req.body || {};

    // Require a setup key to prevent open registration
    const expectedKey = process.env.SETUP_KEY || "esticlose-setup";
    if (setupKey !== expectedKey) {
      res.status(403).json({ error: "Invalid setup key" });
      return;
    }

    if (!email || !password || !companySlug) {
      res.status(400).json({ error: "email, password, and companySlug are required" });
      return;
    }

    // Ensure company exists
    let company = getCompanyBySlug(companySlug);
    if (!company) {
      // Auto-create company from config
      const { getCompanyConfig } = await import("../../config");
      const config = getCompanyConfig(companySlug);
      if (!config) {
        res.status(400).json({ error: `No config found for company slug: ${companySlug}` });
        return;
      }
      company = upsertCompany({ slug: companySlug, name: config.company.name });
    }

    if (!company) {
      res.status(500).json({ error: "Failed to create company" });
      return;
    }

    // Check if user already exists
    const existing = getAdminUserByEmail(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: "User already exists" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = createAdminUser({
      email: email.toLowerCase().trim(),
      password: hashed,
      companyId: company.id,
    });

    res.json({ success: true, userId: user?.id, companySlug: company.slug });
  });

  // OAuth callback
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ── Image retention: run cleanup on startup and every 24h ──
  const runRetention = () => {
    try {
      const s3Urls = clearExpiredImages();
      if (s3Urls.length > 0) {
        console.log(`[Retention] Cleared images from ${s3Urls.length} expired estimates (S3 deletion pending)`);
      }
    } catch (err) {
      console.error("[Retention] Error during image cleanup:", err);
    }
  };
  // Run once on startup (delayed to let DB init)
  setTimeout(runRetention, 5000);
  // Run every 24 hours
  setInterval(runRetention, 24 * 60 * 60 * 1000);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
