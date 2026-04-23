/**
 * Inbound GHL webhook handler for Tier 2 automation.
 *
 * GHL workflow fires POST /api/webhook/ghl with contact data + before photo URL.
 * This handler:
 *   1. Validates required fields
 *   2. Fetches the before image and uploads to S3
 *   3. Runs the Gemini 3-step image pipeline (generates after image, uploads to S3)
 *   4. Creates an estimate record with ghlContactId populated
 *   5. Writes results back to GHL via the existing outbound contact update path
 *
 * The webhook responds immediately with 200 + { received: true, jobId } to avoid
 * GHL timeout, then processes the pipeline asynchronously.
 */
import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { generateImage } from "./imageGeneration";
import { isS3Configured, isOwnedS3Url, extractKeyFromS3Url, getObjectFromS3 } from "./s3";
import { nameToSlug, upsertEstimate, getEstimateBySlug } from "../db";
import { readCompanyConfig, companySlug } from "./configWriter";

// ---------------------------------------------------------------------------
// Payload shape — minimum required fields from GHL webhook
// ---------------------------------------------------------------------------

type GhlWebhookPayload = {
  contactId: string;
  beforePhotoUrl: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  service?: string;
  serviceType?: string;
  price?: number;
  bookingLink?: string;
  companyName?: string;
  companyLogoUrl?: string;
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePayload(body: unknown): { valid: true; data: GhlWebhookPayload } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.contactId !== "string" || !b.contactId.trim()) {
    return { valid: false, error: "Missing required field: contactId" };
  }
  if (typeof b.beforePhotoUrl !== "string" || !b.beforePhotoUrl.trim()) {
    return { valid: false, error: "Missing required field: beforePhotoUrl" };
  }
  // beforePhotoUrl must be a real URL, not a data URI
  if (b.beforePhotoUrl.toString().startsWith("data:")) {
    return { valid: false, error: "beforePhotoUrl must be an HTTPS URL, not a data URI" };
  }

  // name: derive from firstName/lastName if not provided directly
  let name: string;
  if (typeof b.name === "string" && b.name.trim()) {
    name = b.name.trim();
  } else if (typeof b.firstName === "string" && b.firstName.trim()) {
    const last = typeof b.lastName === "string" ? b.lastName.trim() : "";
    name = last ? `${b.firstName.trim()} ${last}` : b.firstName.trim();
  } else {
    return { valid: false, error: "Missing required field: name (or firstName)" };
  }

  const ALLOWED_SERVICE_TYPES = ["bathtub", "shower", "jacuzzi"];
  const rawServiceType = typeof b.serviceType === "string" ? b.serviceType.toLowerCase() : "bathtub";
  const serviceType = ALLOWED_SERVICE_TYPES.includes(rawServiceType) ? rawServiceType : "bathtub";

  return {
    valid: true,
    data: {
      contactId: b.contactId as string,
      beforePhotoUrl: (b.beforePhotoUrl as string).trim(),
      name,
      firstName: typeof b.firstName === "string" ? b.firstName.trim() : undefined,
      lastName: typeof b.lastName === "string" ? b.lastName.trim() : undefined,
      email: typeof b.email === "string" ? b.email.trim() || undefined : undefined,
      phone: typeof b.phone === "string" ? b.phone.trim() || undefined : undefined,
      address: typeof b.address === "string" ? b.address.trim() || undefined : undefined,
      service: typeof b.service === "string" && b.service.trim() ? b.service.trim() : "Tub",
      serviceType,
      price: typeof b.price === "number" && b.price > 0 ? b.price : 449,
      bookingLink: typeof b.bookingLink === "string" ? b.bookingLink.trim() || undefined : undefined,
      companyName: typeof b.companyName === "string" ? b.companyName.trim() || undefined : undefined,
      companyLogoUrl: typeof b.companyLogoUrl === "string" ? b.companyLogoUrl.trim() || undefined : undefined,
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook secret verification (optional but recommended)
// ---------------------------------------------------------------------------

function verifyWebhookSecret(req: Request): boolean {
  const secret = ENV.ghlWebhookSecret;
  if (!secret) return true; // no secret configured — allow all requests
  const provided = req.headers["x-ghl-webhook-secret"] || req.query.secret;
  return provided === secret;
}

// ---------------------------------------------------------------------------
// Pipeline processing (runs after immediate 200 response)
// ---------------------------------------------------------------------------

async function processWebhookJob(data: GhlWebhookPayload): Promise<void> {
  const jobTag = `[GHL-Webhook][${data.contactId}]`;
  console.log(`${jobTag} Starting pipeline for ${data.name}`);

  // ── Pre-flight checks ──
  if (!isS3Configured()) {
    console.error(`${jobTag} ABORT: S3 is not configured. Cannot store images.`);
    return;
  }
  if (!ENV.geminiApiKey) {
    console.error(`${jobTag} ABORT: GEMINI_API_KEY is not configured. Cannot run image pipeline.`);
    return;
  }
  if (!ENV.publicUrl) {
    console.error(`${jobTag} ABORT: PUBLIC_URL is not configured. Cannot build estimate links.`);
    return;
  }

  // ── Load company config if companyName is provided ──
  let companyConfig: ReturnType<typeof readCompanyConfig> = null;
  if (data.companyName) {
    const cfgSlug = companySlug(data.companyName);
    companyConfig = readCompanyConfig(cfgSlug);
    if (companyConfig) {
      console.log(`${jobTag} Loaded company config: ${cfgSlug}`);
    } else {
      console.log(`${jobTag} No config found for company slug: ${cfgSlug} — using payload values only`);
    }
  }

  // ── Step 1: Fetch before image from S3 via SDK and run pipeline ──
  const beforeUrl = data.beforePhotoUrl;
  if (!isOwnedS3Url(beforeUrl)) {
    console.error(`${jobTag} ABORT: beforePhotoUrl is not an EstiClose-owned S3 URL: ${beforeUrl}`);
    return;
  }

  const s3Key = extractKeyFromS3Url(beforeUrl);
  if (!s3Key) {
    console.error(`${jobTag} ABORT: Could not extract S3 key from URL: ${beforeUrl}`);
    return;
  }

  let afterUrl: string;
  try {
    console.log(`${jobTag} Fetching before image from S3 via SDK: ${s3Key}`);
    const { buffer: beforeBuffer, contentType: beforeContentType } = await getObjectFromS3(s3Key);

    console.log(`${jobTag} Running Gemini 3-step pipeline...`);
    const result = await generateImage({
      prompt: "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish.",
      originalImages: [{ b64Json: beforeBuffer.toString("base64"), mimeType: beforeContentType }],
    });
    if (!result.url) {
      console.error(`${jobTag} ABORT: Image pipeline failed: ${result.error || "no output"}`);
      return;
    }
    afterUrl = result.url;
    console.log(`${jobTag} After image generated: ${afterUrl}`);
  } catch (err: any) {
    console.error(`${jobTag} ABORT: Image pipeline threw: ${err?.message || err}`);
    return;
  }

  // ── Step 3: Create estimate record with ghlContactId ──
  const slug = nameToSlug(data.name, data.firstName, data.lastName, data.companyName);
  let estimate;
  try {
    estimate = upsertEstimate({
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
      service: data.service || "Tub",
      serviceType: data.serviceType || "bathtub",
      price: data.price || (companyConfig as any)?.basePrice || 449,
      beforeUrl,
      afterUrl,
      slug,
      email: data.email,
      phone: data.phone,
      address: data.address,
      duration: "3 Hours",
      status: "New Lead",
      ghlContactId: data.contactId,
      bookingLink: data.bookingLink || companyConfig?.bookingWidgetUrl || undefined,
      companyName: data.companyName || companyConfig?.companyName,
      companyLogoUrl: data.companyLogoUrl || companyConfig?.companyLogoUrl || undefined,
    });
    if (!estimate) {
      console.error(`${jobTag} ABORT: Failed to save estimate to DB`);
      return;
    }
    console.log(`${jobTag} Estimate saved: slug=${slug}, id=${estimate.id}`);
  } catch (err: any) {
    console.error(`${jobTag} ABORT: DB error: ${err?.message || err}`);
    return;
  }

  // ── Step 4: Write results back to GHL ──
  if (!ENV.ghlApiKey) {
    console.warn(`${jobTag} GHL_API_KEY not configured — skipping writeback`);
    return;
  }

  const estimatePageUrl = `${ENV.publicUrl}/estimate/${slug}`;
  try {
    const customFields: Array<{ key: string; field_value: string }> = [
      { key: "Bp_before_photo", field_value: beforeUrl },
      { key: "Bp_after_photo", field_value: afterUrl },
      { key: "Bp_estimate_url", field_value: estimatePageUrl },
      { key: "bp_estimate_sent", field_value: "true" },
      { key: "bp_estimate_sent_at", field_value: new Date().toISOString() },
      { key: "bp_estimate_viewed", field_value: "false" },
      { key: "bp_appointment_booked", field_value: "false" },
      { key: "bp_customer_name", field_value: data.name },
      ...(data.phone ? [{ key: "bp_customer_phone", field_value: data.phone }] : []),
    ];
    if (data.companyLogoUrl) {
      customFields.push({ key: "bp_company_logo", field_value: data.companyLogoUrl });
    }

    const ghlBody: Record<string, unknown> = {
      customFields,
      tags: ["estimate_sent", "tier2_auto"],
    };
    if (data.email) ghlBody.email = data.email;

    const ghlRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/${data.contactId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${ENV.ghlApiKey}`,
          Version: "2021-07-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ghlBody),
      }
    );

    if (!ghlRes.ok) {
      const detail = await ghlRes.text().catch(() => "");
      console.error(`${jobTag} GHL writeback failed (${ghlRes.status})${detail ? `: ${detail}` : ""}`);
    } else {
      console.log(`${jobTag} GHL writeback complete — estimate URL: ${estimatePageUrl}`);
    }
  } catch (err: any) {
    console.error(`${jobTag} GHL writeback error: ${err?.message || err}`);
  }

  console.log(`${jobTag} Pipeline complete.`);
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerGhlWebhookRoutes(app: Express) {
  /**
   * POST /api/webhook/ghl
   *
   * Accepts GHL workflow webhook payload, responds immediately with 200,
   * then processes the pipeline asynchronously.
   *
   * Required fields:
   *   - contactId: string (GHL contact ID)
   *   - beforePhotoUrl: string (HTTPS URL to the before photo)
   *   - name: string (customer name) OR firstName + lastName
   *
   * Optional fields:
   *   - email, phone, address, service, serviceType, price,
   *     bookingLink, companyName, companyLogoUrl
   *
   * Security:
   *   - If GHL_WEBHOOK_SECRET is set, requires x-ghl-webhook-secret header
   *     or ?secret= query param to match.
   */
  app.post("/api/webhook/ghl", (req: Request, res: Response) => {
    // Verify webhook secret if configured
    if (!verifyWebhookSecret(req)) {
      console.warn("[GHL-Webhook] Rejected: invalid webhook secret");
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    // Validate payload
    const validation = validatePayload(req.body);
    if (!validation.valid) {
      console.warn(`[GHL-Webhook] Rejected: ${validation.error}`);
      res.status(400).json({ error: validation.error });
      return;
    }

    const { data } = validation;

    // Respond immediately — GHL has short timeout expectations
    res.status(200).json({
      received: true,
      contactId: data.contactId,
      message: "Pipeline job started. Results will be written back to GHL contact.",
    });

    // Process asynchronously — do not await
    processWebhookJob(data).catch((err) => {
      console.error(`[GHL-Webhook] Unhandled pipeline error for ${data.contactId}:`, err);
    });
  });

  console.log("[GHL-Webhook] Registered POST /api/webhook/ghl");
}
