import type { Express, Request, Response } from "express";
import express from "express";
import type Stripe from "stripe";
import { ENV } from "./env";
import { getStripe } from "./stripe";
import { getCompanyBySlug, updateCompanyStripeMapping } from "../db";

async function ensureUsagePriceAttached(stripe: Stripe, subscription: Stripe.Subscription): Promise<void> {
  const usagePriceId = ENV.stripeUsagePriceId;
  if (!usagePriceId) {
    console.warn("[Stripe-Webhook] STRIPE_USAGE_PRICE_ID not configured — skipping usage price attachment");
    return;
  }

  if (subscription.status !== "active" && subscription.status !== "trialing") {
    console.log(`[Stripe-Webhook] Subscription ${subscription.id} status is "${subscription.status}" — skipping usage price attachment`);
    return;
  }

  try {
    const live = await stripe.subscriptions.retrieve(subscription.id, { expand: ["items"] });
    const items = live.items?.data ?? [];
    const existingItem = items.find((item) => item.price.id === usagePriceId);

    let usageItemId: string;

    if (existingItem) {
      console.log(`[Stripe-Webhook] Usage price ${usagePriceId} already attached to subscription ${subscription.id}`);
      usageItemId = existingItem.id;
    } else {
      const newItem = await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: usagePriceId,
      });
      console.log(`[Stripe-Webhook] Attached usage price ${usagePriceId} to subscription ${subscription.id} (item: ${newItem.id})`);
      usageItemId = newItem.id;
    }

    // Populate company ↔ Stripe mapping
    const locationId = subscription.metadata?.altId;
    if (locationId) {
      const company = getCompanyBySlug(locationId);
      if (company) {
        updateCompanyStripeMapping(company.id, {
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
          stripeSubscriptionId: subscription.id,
          stripeSubscriptionItemId: usageItemId,
        });
      } else {
        console.warn(`[Stripe-Webhook] No company found for metadata.altId="${locationId}" — Stripe mapping not saved`);
      }
    } else {
      console.warn(`[Stripe-Webhook] Subscription ${subscription.id} has no metadata.altId — cannot map to company`);
    }
  } catch (err: any) {
    console.error(`[Stripe-Webhook] Failed to attach usage price to subscription ${subscription.id}:`, err?.message);
  }
}

export function registerStripeWebhookRoutes(app: Express): void {
  app.post(
    "/api/webhook/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      if (!ENV.stripeWebhookSecret) {
        res.status(400).json({ error: "Webhook signing secret not configured" });
        return;
      }

      const sig = req.headers["stripe-signature"] as string;
      if (!sig) {
        res.status(400).json({ error: "Missing stripe-signature header" });
        return;
      }

      const stripe = getStripe();

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
      } catch (err: any) {
        console.error("[Stripe-Webhook] Signature verification failed:", err?.message);
        res.status(400).json({ error: "Invalid signature" });
        return;
      }

      console.log(`[Stripe-Webhook] Received ${event.type} (${event.id})`);

      switch (event.type) {
        case "customer.subscription.created":
          await ensureUsagePriceAttached(stripe, event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.updated":
          await ensureUsagePriceAttached(stripe, event.data.object as Stripe.Subscription);
          break;
        case "invoice.finalized":
          console.log(`[Stripe-Webhook] invoice.finalized — ${event.id}`);
          break;
        default:
          console.log(`[Stripe-Webhook] Unhandled event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    }
  );

  console.log("[Stripe-Webhook] Registered POST /api/webhook/stripe");
}
