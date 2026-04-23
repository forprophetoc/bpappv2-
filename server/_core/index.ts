import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGhlWebhookRoutes } from "./ghlWebhook";
import { isS3Configured, getPresignedUploadUrl, uploadGeneratedImageToS3, getObjectFromS3 } from "./s3";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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
  // Browser-checkable health endpoint
  app.get("/health", (_req, res) => res.json({ ok: true }));
  // Test upload page
  app.get("/test-upload", (_req, res) => {
    res.sendFile(path.resolve(import.meta.dirname, "../../client/src/test-upload.html"));
  });
  // Pre-signed S3 upload URL endpoint
  app.all("/api/upload/presign", async (req, res) => {
    if (!isS3Configured()) {
      return res.status(503).json({ error: "S3 not configured" });
    }
    const contentType = req.body?.contentType || req.query.contentType || "image/jpeg";
    try {
      const result = await getPresignedUploadUrl({ contentType: contentType as string, prefix: "before" });
      res.json(result);
    } catch (err: any) {
      console.error("[presign] Failed:", err?.message || err);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });
  // Direct server-side upload (bypasses presign IAM issue)
  app.post("/api/upload/direct", express.raw({ type: "image/*", limit: "50mb" }), async (req, res) => {
    if (!isS3Configured()) {
      return res.status(503).json({ error: "S3 not configured" });
    }
    try {
      const contentType = req.headers["content-type"] || "image/jpeg";
      const result = await uploadGeneratedImageToS3({
        buffer: Buffer.from(req.body),
        contentType,
        key: `before/${Date.now()}-${crypto.randomUUID()}.jpg`,
      });
      res.json({ publicUrl: result.url, key: result.key });
    } catch (err: any) {
      console.error("[upload/direct] Failed:", err?.message || err);
      res.status(500).json({ error: err?.message || "Upload failed" });
    }
  });
  // Image proxy — serves S3 objects via SDK (no public bucket needed)
  app.get("/api/images/*", async (req, res) => {
    if (!isS3Configured()) {
      return res.status(503).send("S3 not configured");
    }
    const key = req.params[0];
    if (!key) return res.status(400).send("Missing key");
    try {
      const { buffer, contentType } = await getObjectFromS3(key);
      res.set("Content-Type", contentType);
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      res.send(buffer);
    } catch (err: any) {
      console.error("[image-proxy] Failed:", key, err?.message);
      res.status(404).send("Image not found");
    }
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // GHL inbound webhook for Tier 2 automation
  registerGhlWebhookRoutes(app);
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
