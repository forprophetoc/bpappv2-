import Stripe from "stripe";
import { ENV } from "./env";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!ENV.stripeSecretKey) {
    throw new Error("FATAL: STRIPE_SECRET_KEY is not configured — server cannot start");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(ENV.stripeSecretKey, {
      apiVersion: "2026-04-22.dahlia",
    });
  }
  return stripeClient;
}

/**
 * Report a single usage event to Stripe via Billing Meters.
 * Uses estimateSlug as idempotency key to prevent duplicate billing.
 * Returns the meter event identifier on success, or null on failure.
 */
export async function reportStripeUsageEvent(
  subscriptionItemId: string,
  estimateSlug: string,
  stripeCustomerId: string,
): Promise<string | null> {
  try {
    const stripe = getStripe();
    const event = await stripe.billing.meterEvents.create({
      event_name: "estimate_usage",
      payload: {
        value: "1",
        stripe_customer_id: stripeCustomerId,
      },
    }, { idempotencyKey: `meter-${estimateSlug}` });
    console.log(`[Stripe-Usage] Reported meter event for "${estimateSlug}" customer ${stripeCustomerId} (id: ${event.identifier})`);
    return event.identifier;
  } catch (err: any) {
    console.error(`[Stripe-Usage] Failed to report usage for "${estimateSlug}":`, err?.message);
    return null;
  }
}
