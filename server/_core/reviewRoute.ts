import express, { type Express, type Request, type Response } from "express";
import { ENV } from "./env";

const ALLOWED_ORIGIN = "https://reviews.bathtubpros.com";

export function registerReviewRoutes(app: Express) {
  // CORS preflight — scoped to this route only
  app.options("/api/review", (_req: Request, res: Response) => {
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
  });

  // text/* is what the Vibe app sends; application/json + urlencoded are already
  // handled by the global body parsers, so this does not clobber them.
  app.post("/api/review", express.text({ type: "text/*" }), async (req: Request, res: Response) => {
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);

    let data: any = req.body;
    if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = {}; } }
    data = data || {};

    if (ENV.reviewWebhookToken && data.token !== ENV.reviewWebhookToken) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (typeof data.cid !== "string" || !data.cid.trim()) {
      return res.status(400).json({ error: "Missing required field: cid" });
    }
    const contactId = data.cid.trim();
    if (!ENV.ghlApiKey) {
      return res.status(500).json({ error: "GHL_API_KEY not configured" });
    }

    try {
      const ghlRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ENV.ghlApiKey}`,
            Version: "2021-07-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tags: ["review_received"] }),
        }
      );
      if (!ghlRes.ok) {
        const detail = await ghlRes.text().catch(() => "");
        console.warn(`[Review] Tag add failed (${ghlRes.status})${detail ? `: ${detail}` : ""}`);
        return res.status(502).json({ error: "GHL tag update failed" });
      }
      console.log(`[Review] review_received tag added for contact ${contactId}`);
      return res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error(`[Review] Error tagging contact ${contactId}:`, err?.message || err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  console.log("[Review] Registered POST /api/review");
}
