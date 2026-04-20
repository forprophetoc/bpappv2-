import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getEstimateBySlug } from "../db";
import { ENV } from "./env";
import { signAdminToken, isAdminAuthenticated, ADMIN_COOKIE_NAME } from "./adminAuth";
import { timingSafeEqual } from "crypto";

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
  // Trust reverse proxy headers (X-Forwarded-Proto, X-Forwarded-Host) for correct URL generation
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
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
  // Admin password gate
  app.post("/api/admin/login", async (req, res) => {
    const { password } = req.body || {};
    if (!ENV.adminPassword) {
      res.json({ success: true });
      return;
    }
    if (!password || typeof password !== "string") {
      res.status(401).json({ error: "Password required" });
      return;
    }
    const a = Buffer.from(password);
    const b = Buffer.from(ENV.adminPassword);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({ error: "Invalid password" });
      return;
    }
    const token = await signAdminToken();
    res.cookie(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: ENV.isProduction,
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    res.json({ success: true });
  });

  app.get("/api/admin/check", async (req, res) => {
    const authenticated = await isAdminAuthenticated(req as any);
    res.json({ authenticated });
  });

  app.post("/api/admin/logout", (_req, res) => {
    res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
    res.json({ success: true });
  });

  // OAuth callback under /api/oauth/callback
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
