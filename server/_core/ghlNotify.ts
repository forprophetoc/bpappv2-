import { ENV } from "./env";
import { getEstimateBySlug } from "../db";
import fs from "fs";
import path from "path";

function appendDebugLog(message: string): void {
  try {
    const logDir = path.resolve(import.meta.dirname, "..", "..", "data");
    const logPath = path.join(logDir, "ghl-debug.log");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // Silently swallow — diagnostic logging must never break the integration
  }
}

function safeUrl(u: string | null | undefined): string {
  if (!u) return "";
  if (u.startsWith("data:")) return "";
  return u;
}

/**
 * POST estimate data to the GHL form-submission URL so the contact
 * gets the "estimate sent" tag and the 5-touch follow-up sequence fires.
 *
 * Idempotency: GHL deduplicates contacts by phone/email and adds tags
 * only once, so we don't need a local "already-sent" flag — multiple
 * clicks on Send produce one effect downstream.
 *
 * Field-name mapping is best-guess from the form's display names
 * (snake_case). May need adjustment after live testing.
 */
export async function submitEstimateToGHL(slug: string): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  appendDebugLog(`submitEstimateToGHL called for slug: ${slug}`);
  const url = ENV.ghlWebhookUrl;
  appendDebugLog(`ENV.ghlWebhookUrl is: ${url ? "SET" : "EMPTY"}`);
  if (!url) {
    appendDebugLog("EARLY RETURN — GHL_WEBHOOK_URL not configured. Aborting.");
    return { success: false, error: "GHL_WEBHOOK_URL not configured" };
  }

  const estimate = getEstimateBySlug(slug);
  appendDebugLog(`Estimate lookup result: ${estimate ? `FOUND id=${estimate.id}` : "NOT FOUND"}`);
  if (!estimate) {
    return { success: false, error: `No estimate found for slug "${slug}"` };
  }

  // Construct the public estimate URL
  const publicBase = (ENV.publicUrl || "").replace(/\/+$/, "");
  const estimatePageUrl = publicBase
    ? `${publicBase}/estimate/${estimate.slug}`
    : `/estimate/${estimate.slug}`;

  // Build form-data payload — keys are best-guess snake_case based on
  // the GHL form's field display names. Adjust here if GHL rejects fields.
  const payload: Record<string, string> = {
    first_name: estimate.firstName ?? "",
    last_name: estimate.lastName ?? "",
    phone: estimate.phone ?? "",
    email: estimate.email ?? "",
    scope_of_work: estimate.service ?? "",
    quote_price: String(estimate.price ?? ""),
    before_image_url: safeUrl(estimate.beforeUrl),
    after_image_url: safeUrl(estimate.afterUrl),
    service_type: estimate.serviceType ?? "",
    estimate_page_url: estimatePageUrl,
    transformation_image_url: safeUrl(estimate.transformationImageUrl),
    bathroom_sink_refinishing_price: estimate.bathroomSinkPrice
      ? String(estimate.bathroomSinkPrice)
      : "",
  };

  // Strip empty values to keep the payload clean
  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== ""),
  );

  const body = JSON.stringify(cleaned);

  try {
    appendDebugLog(`About to POST. Body length: ${body.length}. Payload keys: ${Object.keys(cleaned).join(",")}`);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
    const text = await resp.text();
    if (resp.ok) {
      appendDebugLog(`POST response: ${resp.status} OK`);
      console.log(
        `[GHL-Notify] Submitted estimate "${slug}" → status ${resp.status}`,
      );
      return { success: true, status: resp.status };
    } else {
      appendDebugLog(`POST response: ${resp.status} NOT OK — ${text.slice(0, 200)}`);
      console.warn(
        `[GHL-Notify] Failed for "${slug}" — status ${resp.status}: ${text.slice(0, 300)}`,
      );
      return {
        success: false,
        status: resp.status,
        error: text.slice(0, 500),
      };
    }
  } catch (err: any) {
    console.error(`[GHL-Notify] Exception for "${slug}":`, err?.message);
    return { success: false, error: err?.message ?? "unknown error" };
  }
}

/**
 * Update the GHL contact when the customer first views their estimate.
 * Uses the same form-submission endpoint as submitEstimateToGHL — GHL
 * deduplicates by phone/email so the existing contact gets updated
 * with `estimate_viewed: "true"`, which fires the 5-touch workflow's
 * if/else branch on that field.
 *
 * Identifying fields (first_name, last_name, phone, email) are sent
 * so GHL can match the existing contact. estimate_page_url is sent
 * too in case GHL has cleared it for any reason.
 */
export async function submitEstimateViewedToGHL(slug: string): Promise<{
  success: boolean;
  status?: number;
  error?: string;
}> {
  const url = ENV.ghlWebhookUrl;
  if (!url) {
    return { success: false, error: "GHL_WEBHOOK_URL not configured" };
  }

  const estimate = getEstimateBySlug(slug);
  if (!estimate) {
    return { success: false, error: `No estimate found for slug "${slug}"` };
  }

  const publicBase = (ENV.publicUrl || "").replace(/\/+$/, "");
  const estimatePageUrl = publicBase
    ? `${publicBase}/estimate/${estimate.slug}`
    : `/estimate/${estimate.slug}`;

  // Identifying fields + the viewed flag. GHL upserts by phone/email.
  const payload: Record<string, string> = {
    first_name: estimate.firstName ?? "",
    last_name: estimate.lastName ?? "",
    phone: estimate.phone ?? "",
    email: estimate.email ?? "",
    estimate_page_url: estimatePageUrl,
    estimate_viewed: "true",
  };

  const cleaned = Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== ""),
  );

  const body = JSON.stringify(cleaned);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await resp.text();
    if (resp.ok) {
      console.log(
        `[GHL-Notify] Marked estimate "${slug}" as viewed → status ${resp.status}`,
      );
      return { success: true, status: resp.status };
    } else {
      console.warn(
        `[GHL-Notify] Viewed-update failed for "${slug}" — status ${resp.status}: ${text.slice(0, 300)}`,
      );
      return {
        success: false,
        status: resp.status,
        error: text.slice(0, 500),
      };
    }
  } catch (err: any) {
    console.error(`[GHL-Notify] Viewed-update exception for "${slug}":`, err?.message);
    return { success: false, error: err?.message ?? "unknown error" };
  }
}
