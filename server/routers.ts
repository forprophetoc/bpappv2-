import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { generateImage } from "./_core/imageGeneration";
import { isS3Configured, uploadGeneratedImageToS3 } from "./_core/s3";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getStripe } from "./_core/stripe";
import { reportStripeUsageEvent } from "./_core/stripe";
import { submitEstimateToGHL, submitEstimateViewedToGHL } from "./_core/ghlNotify";
import { incrementUsage } from "./usage";
import { getAllEstimates, getCompanyStripeMapping, getEstimateBySlug, markEstimateViewed, markUsageEventReported, meterEstimateIfNeeded, nameToSlug, updateEstimateStatus, upsertEstimate } from "./db";

export const appRouter = router({
  system: systemRouter,

  pipeline: router({
    /** Returns which API keys / services are configured — never exposes secrets */
    keyStatus: publicProcedure.query(() => {
      return {
        gemini: !!ENV.geminiApiKey,
        s3: !!(ENV.awsAccessKeyId && ENV.awsSecretAccessKey && ENV.awsBucketName),
        ghl: !!ENV.ghlApiKey,
      };
    }),

    /**
     * Run the before→after image pipeline from an uploaded file (base64).
     * Returns { afterUrl, status, error? }
     */
    testImage: publicProcedure
      .input(
        z.object({
          imageBase64: z.string().min(1),
          mimeType: z.string().default("image/png"),
          serviceType: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Service gating — only approved types may trigger the pipeline
        const ALLOWED_SERVICE_TYPES = ["bathtub", "shower", "jacuzzi", "tub_tile"];
        if (input.serviceType && !ALLOWED_SERVICE_TYPES.includes(input.serviceType)) {
          return {
            afterUrl: null,
            status: "skipped" as const,
            error: `Image pipeline not available for service type: ${input.serviceType}`,
          };
        }

        const result = await generateImage({
          prompt: "", // ignored — pipeline uses vertical-specific prompts
          serviceType: input.serviceType,
          originalImages: [{ b64Json: input.imageBase64, mimeType: input.mimeType }],
        });
        if (!result.url) {
          return {
            afterUrl: null,
            status: "failed" as const,
            error: result.error || "Image generation failed — no output from OpenAI",
          };
        }
        return {
          afterUrl: result.url,
          status: "success" as const,
          error: null,
        };
      }),

    /** Upload a before image (base64) to S3 and return the public URL. */
    uploadBeforeImage: publicProcedure
      .input(
        z.object({
          imageBase64: z.string().min(1),
          mimeType: z.string().default("image/png"),
        })
      )
      .mutation(async ({ input }) => {
        if (!isS3Configured()) {
          return { url: null, error: "S3 is not configured" };
        }
        try {
          const buffer = Buffer.from(input.imageBase64, "base64");
          const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("webp") ? "webp" : "jpg";
          const key = `before/${Date.now()}-${crypto.randomUUID()}.${ext}`;
          const { url } = await uploadGeneratedImageToS3({
            buffer,
            contentType: input.mimeType,
            key,
          });
          return { url, error: null };
        } catch (err: any) {
          return { url: null, error: err?.message || "S3 upload failed" };
        }
      }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  estimates: router({
    /**
     * Create or update an estimate record and return the short slug-based URL.
     * Protected: only authenticated (owner) users can create estimates.
     */
    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          service: z.string().min(1),
          serviceType: z.enum(["bathtub", "shower", "jacuzzi", "tub_tile"]).default("bathtub"),
          price: z.number().int().positive(),
          beforeUrl: z.string().min(1).optional(),
          afterUrl: z.string().min(1).optional(),
          transformationImageUrl: z.string().url().optional(),
          transformationPrice: z.number().int().positive().optional(),
          bathroomSinkPrice: z.number().int().positive().optional(),
          kitchenSinkPrice: z.number().int().positive().optional(),
          tileSurroundPrice: z.number().int().positive().optional(),
          otherBathroomPrice: z.number().int().positive().optional(),
          bookingLink: z.string().optional(),
          calendarEmbed: z.string().optional(),
          ghlContactId: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          duration: z.string().optional(),
          notes: z.string().optional(),
          companyLogoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const slug = nameToSlug(input.name, input.firstName, input.lastName);

        // 1. Use pre-generated afterUrl if provided (from pipeline.testImage),
        //    otherwise generate after image from the before photo (approved services only).
        const ALLOWED_PIPELINE_TYPES = ["bathtub", "shower", "jacuzzi", "tub_tile"];
        let afterUrl: string;
        if (input.afterUrl) {
          afterUrl = input.afterUrl;
        } else if (ALLOWED_PIPELINE_TYPES.includes(input.serviceType)) {
          const { url: generatedAfterUrl, error: genError } = await generateImage({
            prompt: "", // ignored — pipeline uses vertical-specific prompts
            serviceType: input.serviceType,
            originalImages: [{ url: input.beforeUrl }],
          });
          if (!generatedAfterUrl) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Image generation failed for ${input.serviceType}. Please retry or upload an after image manually.${genError ? ` (${genError})` : ""}`,
            });
          }
          afterUrl = generatedAfterUrl;
          // Increment local file-based usage counter (in-app display).
          // Stripe Billing Meters remains source of truth for billing — this counter is purely for UI/display.
          // Wrapped in try/catch so counter write failures never break estimate save.
          try {
            incrementUsage(slug);
          } catch (err) {
            console.warn(`[Usage] Failed to increment counter for "${slug}":`, err);
          }
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `No after image provided and service type "${input.serviceType}" has no pipeline configured.`,
          });
        }

        // 2. Save estimate to DB
        const estimate = upsertEstimate({
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          service: input.service,
          serviceType: input.serviceType,
          price: input.price,
          beforeUrl: input.beforeUrl ?? "",
          afterUrl,
          transformationImageUrl: input.transformationImageUrl,
          transformationPrice: input.transformationPrice,
          bathroomSinkPrice: input.bathroomSinkPrice,
          kitchenSinkPrice: input.kitchenSinkPrice,
          tileSurroundPrice: input.tileSurroundPrice,
          otherBathroomPrice: input.otherBathroomPrice,
          bookingLink: input.bookingLink,
          calendarEmbed: input.calendarEmbed,
          slug,
          email: input.email,
          phone: input.phone,
          address: input.address,
          duration: input.duration || "3 Hours",
          notes: input.notes,
          status: "New Lead",
          ghlContactId: input.ghlContactId,
          companyLogoUrl: input.companyLogoUrl,
        });
        if (!estimate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save estimate" });

        // 3. Update GHL contact fields (fire-and-log — estimate is already saved)
        if (input.ghlContactId && ENV.ghlApiKey) {
          const origin = ENV.publicUrl || `${ctx.req.protocol}://${ctx.req.get("host")}`;
          const estimatePageUrl = `${origin.replace(/\/+$/, "")}/estimate/${slug}`;
          try {
            const beforeIsHosted = input.beforeUrl && !input.beforeUrl.startsWith("data:");
            const customFields: Array<{ key: string; field_value: string }> = [
              ...(beforeIsHosted ? [{ key: "Bp_before_photo", field_value: input.beforeUrl! }] : []),
              ...(afterUrl ? [{ key: "Bp_after_photo",  field_value: afterUrl }] : []),
              { key: "Bp_estimate_url", field_value: estimatePageUrl },
              // State fields for GHL workflow automation
              { key: "bp_estimate_sent", field_value: "true" },
              { key: "bp_estimate_sent_at", field_value: new Date().toISOString() },
              { key: "bp_estimate_viewed", field_value: "false" },
              { key: "bp_appointment_booked", field_value: "false" },
              { key: "bp_customer_name", field_value: input.name },
              ...(input.phone ? [{ key: "bp_customer_phone", field_value: input.phone }] : []),
              { key: "bp_service_type", field_value: input.serviceType },
              { key: "bp_quote_price", field_value: String(input.price) },
              ...(input.transformationImageUrl ? [{ key: "bp_transformation_image_url", field_value: input.transformationImageUrl }] : []),
            ];
            if (input.companyLogoUrl) {
              customFields.push({ key: "bp_company_logo", field_value: input.companyLogoUrl });
            }

            const ghlBody: Record<string, unknown> = {
              customFields,
              tags: ["estimate_sent"],
            };
            if (input.email) ghlBody.email = input.email;

            const ghlRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/${input.ghlContactId}`,
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
              console.warn(`[GHL] Contact update failed (${ghlRes.status})${detail ? `: ${detail}` : ""}`);
            }
          } catch (err) {
            console.warn("[GHL] Contact update error:", err);
          }
        }

        // 4. Usage metering (non-blocking — estimate is already saved)
        if (estimate.companyId) {
          try {
            const mapping = getCompanyStripeMapping(estimate.companyId);
            if (mapping?.stripeSubscriptionId && mapping.stripeSubscriptionItemId && mapping.stripeCustomerId) {
              const stripe = getStripe();
              const sub = await stripe.subscriptions.retrieve(mapping.stripeSubscriptionId) as any;
              const periodStart = sub.current_period_start as number;
              const periodEnd = sub.current_period_end as number;

              const { metered, sequenceNum } = meterEstimateIfNeeded(
                estimate.companyId, estimate.id, slug, periodStart, periodEnd
              );

              if (metered) {
                console.log(`[Usage] Estimate #${sequenceNum} "${slug}" exceeds free tier — reporting to Stripe`);
                const recordId = await reportStripeUsageEvent(mapping.stripeSubscriptionItemId, slug, mapping.stripeCustomerId);
                if (recordId) {
                  markUsageEventReported(slug, recordId);
                }
              } else {
                console.log(`[Usage] Estimate #${sequenceNum} "${slug}" — within free tier or already reported`);
              }
            }
          } catch (meterErr: any) {
            console.error(`[Usage] Metering failed for "${slug}" — estimate still saved:`, meterErr?.message);
          }
        }

        return { slug, estimate };
      }),

    /**
     * Read sink pricing from GHL sub-account Custom Values.
     * Returns { bathroomSinkPrice, kitchenSinkPrice } — null when not configured.
     */
    sinkPricing: publicProcedure.query(async () => {
      // Default sink prices — used when GHL custom values are not configured
      const DEFAULT_BATHROOM_SINK = 199;
      const DEFAULT_KITCHEN_SINK = 249;

      if (!ENV.ghlApiKey || !ENV.ghlLocationId) {
        return { bathroomSinkPrice: DEFAULT_BATHROOM_SINK, kitchenSinkPrice: DEFAULT_KITCHEN_SINK };
      }

      try {
        const res = await fetch(
          `https://services.leadconnectorhq.com/locations/${ENV.ghlLocationId}/customValues`,
          {
            headers: {
              Authorization: `Bearer ${ENV.ghlApiKey}`,
              Version: "2021-07-28",
            },
          }
        );
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.warn(`[GHL] Custom values fetch failed (${res.status})${detail ? `: ${detail}` : ""}`);
          return { bathroomSinkPrice: DEFAULT_BATHROOM_SINK, kitchenSinkPrice: DEFAULT_KITCHEN_SINK };
        }

        const data = await res.json();
        const customValues: Array<{ name: string; fieldKey: string; value: string }> = data.customValues || [];

        let bathroomSinkPrice: number | null = null;
        let kitchenSinkPrice: number | null = null;

        for (const cv of customValues) {
          const key = (cv.fieldKey || cv.name || "").toLowerCase();
          if (key.includes("bathroom") && key.includes("sink")) {
            const parsed = parseInt(cv.value, 10);
            if (!isNaN(parsed) && parsed > 0) bathroomSinkPrice = parsed;
          } else if (key.includes("kitchen") && key.includes("sink")) {
            const parsed = parseInt(cv.value, 10);
            if (!isNaN(parsed) && parsed > 0) kitchenSinkPrice = parsed;
          }
        }

        return {
          bathroomSinkPrice: bathroomSinkPrice ?? DEFAULT_BATHROOM_SINK,
          kitchenSinkPrice: kitchenSinkPrice ?? DEFAULT_KITCHEN_SINK,
        };
      } catch (err) {
        console.warn("[GHL] Custom values fetch error:", err);
        return { bathroomSinkPrice: DEFAULT_BATHROOM_SINK, kitchenSinkPrice: DEFAULT_KITCHEN_SINK };
      }
    }),

    /** List all estimates (for dashboard / all-jobs). */
    list: publicProcedure.query(() => getAllEstimates()),

    /** Update the status of an estimate. */
    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["New Lead", "Estimate Sent", "Appointment Booked", "Completed"]),
      }))
      .mutation(async ({ input }) => {
        updateEstimateStatus(input.id, input.status);

        // Fire GHL update when status changes to Appointment Booked
        if (input.status === "Appointment Booked" && ENV.ghlApiKey) {
          const allEstimates = getAllEstimates();
          const est = allEstimates.find((e) => e.id === input.id);
          if (est?.ghlContactId) {
            try {
              const ghlBody: Record<string, unknown> = {
                customFields: [
                  { key: "bp_appointment_booked", field_value: "true" },
                  { key: "bp_appointment_booked_at", field_value: new Date().toISOString() },
                ],
                tags: ["appointment_booked"],
              };
              const ghlRes = await fetch(
                `https://services.leadconnectorhq.com/contacts/${est.ghlContactId}`,
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
                console.warn(`[GHL] Booked alert failed (${ghlRes.status})${detail ? `: ${detail}` : ""}`);
              } else {
                console.log(`[GHL] Appointment booked alert sent for ${est.name}`);
              }
            } catch (err) {
              console.warn("[GHL] Booked alert error:", err);
            }
          }
        }

        return { success: true };
      }),

    /**
     * Fetch a single estimate by slug. Public — no auth required.
     */
    bySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(async ({ input }) => {
        const estimate = getEstimateBySlug(input.slug);
        if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
        return estimate;
      }),

    /**
     * Mark an estimate as viewed (first view only).
     * Persists viewedAt timestamp, updates status, and fires GHL alert.
     */
    markViewed: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const { alreadyViewed, estimate } = markEstimateViewed(input.slug);
        if (alreadyViewed || !estimate) {
          return { alreadyViewed: true };
        }

        // Fire GHL form re-submission to update estimate_viewed=true (drives 5-touch branching)
        await submitEstimateViewedToGHL(input.slug);

        return { alreadyViewed: false };
      }),

    /**
     * POST estimate data to GHL form when admin clicks Send SMS or Send Email.
     * Fire-and-forget — does not block the native SMS/Email handler.
     * Idempotent: GHL deduplicates by phone/email.
     */
    notifyGHL: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const result = await submitEstimateToGHL(input.slug);
        return result;
      }),
  }),
});

export type AppRouter = typeof appRouter;
