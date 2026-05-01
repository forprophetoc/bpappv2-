import { type Express, type Request, type Response } from "express";
import { nameToSlug, upsertEstimate } from "../db";

/**
 * GHL inbound webhook handler.
 *
 * Route: POST /api/ghl/webhook
 *
 * Expects a JSON body with GHL contact/custom-field data.
 * Creates (or updates) a local estimate record and returns the slug.
 *
 * GHL webhook payload shape (relevant fields):
 *   contact_id, first_name, last_name, full_name, email, phone, address1,
 *   and customData entries keyed by field name.
 */

// Maps common GHL service labels → internal serviceType
const SERVICE_TYPE_MAP: Record<string, string> = {
  tub: "bathtub",
  bathtub: "bathtub",
  "bathtub refinishing": "bathtub",
  shower: "shower",
  "shower refinishing": "shower",
  jacuzzi: "jacuzzi",
  "soaking tub": "jacuzzi",
  "soaking tub/jacuzzi": "jacuzzi",
};

function normalizeServiceType(raw: string | undefined): "bathtub" | "shower" | "jacuzzi" {
  if (!raw) return "bathtub";
  const key = raw.toLowerCase().trim();
  return (SERVICE_TYPE_MAP[key] ?? "bathtub") as "bathtub" | "shower" | "jacuzzi";
}

/**
 * Extract a value from GHL's customData array or flat custom field keys.
 * GHL webhooks send custom fields in varying shapes depending on configuration:
 *   - { customData: [ { id, field_key, value }, ... ] }
 *   - flat top-level keys like "bp_service_type"
 */
function getCustomField(body: Record<string, any>, ...keys: string[]): string | undefined {
  // Check flat top-level keys first
  for (const k of keys) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== "") {
      return String(body[k]);
    }
  }
  // Check customData array
  const customData: any[] = body.customData ?? body.custom_data ?? [];
  if (!Array.isArray(customData)) return undefined;
  for (const entry of customData) {
    const fieldKey = (entry.field_key ?? entry.key ?? entry.id ?? "").toLowerCase();
    for (const k of keys) {
      if (fieldKey === k.toLowerCase() && entry.value !== undefined && entry.value !== null && entry.value !== "") {
        return String(entry.value);
      }
    }
  }
  return undefined;
}

export function registerGhlWebhook(app: Express) {
  app.post("/api/ghl/webhook", (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};

      console.log("[GHL Webhook] Received payload:", JSON.stringify(body).slice(0, 500));

      // ---- Extract contact fields ----
      const contactId: string | undefined = body.contact_id ?? body.contactId ?? body.id;
      const firstName: string | undefined = body.first_name ?? body.firstName;
      const lastName: string | undefined = body.last_name ?? body.lastName;
      const fullName: string = body.full_name ?? body.fullName ?? body.name
        ?? ([firstName, lastName].filter(Boolean).join(" ") || "Unknown");
      const email: string | undefined = body.email;
      const phone: string | undefined = body.phone;
      const address: string | undefined = body.address1 ?? body.address;

      // ---- Extract custom fields ----
      const serviceRaw = getCustomField(body, "bp_service_type", "service_type", "service");
      const service = serviceRaw || "Tub";
      const serviceType = normalizeServiceType(serviceRaw);

      const priceRaw = getCustomField(body, "bp_quote_price", "quote_price", "price");
      const price = parseInt(priceRaw ?? "", 10);

      const duration = getCustomField(body, "bp_duration", "duration") ?? "3 Hours";
      const notes = getCustomField(body, "bp_notes", "notes");
      const bookingLink = getCustomField(body, "bp_booking_link", "booking_link");
      const companyLogoUrl = getCustomField(body, "bp_company_logo", "company_logo");

      // ---- Validate minimum required fields ----
      if (!fullName || fullName === "Unknown") {
        console.warn("[GHL Webhook] Missing contact name");
        res.status(400).json({ error: "Missing contact name" });
        return;
      }
      if (isNaN(price) || price <= 0) {
        console.warn("[GHL Webhook] Missing or invalid price");
        res.status(400).json({ error: "Missing or invalid price" });
        return;
      }

      // ---- Create estimate ----
      const slug = nameToSlug(fullName, firstName, lastName);

      const estimate = upsertEstimate({
        name: fullName,
        firstName,
        lastName,
        service,
        serviceType,
        price,
        beforeUrl: "",
        afterUrl: "",
        slug,
        email,
        phone,
        address,
        duration,
        notes,
        status: "New Lead",
        ghlContactId: contactId,
        bookingLink,
        companyLogoUrl,
      });

      if (!estimate) {
        console.error("[GHL Webhook] Failed to save estimate");
        res.status(500).json({ error: "Failed to save estimate" });
        return;
      }

      console.log(`[GHL Webhook] Estimate created: slug=${slug}, name=${fullName}, price=${price}, ghlContactId=${contactId ?? "none"}`);

      res.status(200).json({
        success: true,
        slug,
        estimateId: estimate.id,
      });
    } catch (err: any) {
      console.error("[GHL Webhook] Error:", err?.message || err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
