import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { generateImage } from "./_core/imageGeneration";
import { isS3Configured, uploadGeneratedImageToS3 } from "./_core/s3";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getAllEstimates, getEstimateBySlug, markEstimateViewed, nameToSlug, updateEstimateStatus, upsertEstimate } from "./db";
import { writeCompanyConfig, readCompanyConfig, listCompanyConfigs, companySlug } from "./_core/configWriter";

export const appRouter = router({
  system: systemRouter,

  /**
   * Company onboarding — creates a file-based brand config for a new customer.
   * Config is written to configs/{slug}.json on disk.
   */
  companies: router({
    create: publicProcedure
      .input(
        z.object({
          companyName: z.string().min(1),
          companyShortCode: z.string().min(1).max(10),
          phone: z.string().min(1),
          phoneTel: z.string().min(1),
          email: z.string().optional(),
          website: z.string().optional(),
          serviceArea: z.string().min(1),
          trustStat: z.string().optional().default(""),
          trustTagline: z.string().optional().default(""),
          warrantyLabel: z.string().optional().default(""),
          warrantyDetail: z.string().optional().default(""),
          heroTitle: z.string().optional(),
          heroSubtext: z.string().optional().default(""),
          basePrice: z.number().optional(),
          planName: z.string().optional(),
          ctaText: z.string().optional(),
          comparisonTitle: z.string().optional().default(""),
          comparisonUsLabel: z.string().optional().default(""),
          comparisonUsPoints: z.array(z.string()).optional().default([]),
          comparisonThemLabel: z.string().optional().default(""),
          comparisonThemPoints: z.array(z.string()).optional().default([]),
          benefits: z.array(z.object({ label: z.string(), sub: z.string() })).optional().default([]),
          testimonials: z.array(z.object({ quote: z.string(), author: z.string() })).optional().default([]),
          footerPromo: z.string().optional().default(""),
          calendarUrl: z.string().optional().default(""),
          bookingWidgetUrl: z.string().optional().default(""),
          bookingWidgetId: z.string().optional().default(""),
          companyLogoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const slug = companySlug(input.companyName);

        // Check for duplicate
        const existing = readCompanyConfig(slug);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Company config already exists for "${input.companyName}" (slug: ${slug})`,
          });
        }

        const { filePath } = writeCompanyConfig(input);
        console.log(`[companies.create] Created config for "${input.companyName}" at ${filePath}`);

        return { slug, companyName: input.companyName };
      }),

    /** Update an existing company config (overwrites configs/{slug}.json). */
    update: publicProcedure
      .input(
        z.object({
          slug: z.string().min(1),
          companyName: z.string().min(1),
          companyShortCode: z.string().min(1).max(10),
          phone: z.string().min(1),
          phoneTel: z.string().min(1),
          email: z.string().optional(),
          website: z.string().optional(),
          serviceArea: z.string().min(1),
          trustStat: z.string().optional().default(""),
          trustTagline: z.string().optional().default(""),
          warrantyLabel: z.string().optional().default(""),
          warrantyDetail: z.string().optional().default(""),
          heroTitle: z.string().optional(),
          heroSubtext: z.string().optional().default(""),
          basePrice: z.number().optional(),
          planName: z.string().optional(),
          ctaText: z.string().optional(),
          comparisonTitle: z.string().optional().default(""),
          comparisonUsLabel: z.string().optional().default(""),
          comparisonUsPoints: z.array(z.string()).optional().default([]),
          comparisonThemLabel: z.string().optional().default(""),
          comparisonThemPoints: z.array(z.string()).optional().default([]),
          benefits: z.array(z.object({ label: z.string(), sub: z.string() })).optional().default([]),
          testimonials: z.array(z.object({ quote: z.string(), author: z.string() })).optional().default([]),
          footerPromo: z.string().optional().default(""),
          calendarUrl: z.string().optional().default(""),
          bookingWidgetUrl: z.string().optional().default(""),
          bookingWidgetId: z.string().optional().default(""),
          companyLogoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { slug, ...config } = input;
        const existing = readCompanyConfig(slug);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `No config found for slug: ${slug}`,
          });
        }

        const { filePath } = writeCompanyConfig(config);
        console.log(`[companies.update] Updated config for "${config.companyName}" at ${filePath}`);

        return { slug, companyName: config.companyName };
      }),

    /** Get a company config by slug. */
    bySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(({ input }) => {
        const config = readCompanyConfig(input.slug);
        if (!config) {
          throw new TRPCError({ code: "NOT_FOUND", message: `No config found for slug: ${input.slug}` });
        }
        return config;
      }),

    /** List all onboarded company slugs. */
    list: publicProcedure.query(() => {
      const slugs = listCompanyConfigs();
      return slugs.map((slug) => {
        const config = readCompanyConfig(slug);
        return { slug, companyName: config?.companyName ?? slug };
      });
    }),
  }),

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
        const ALLOWED_SERVICE_TYPES = ["bathtub", "shower", "jacuzzi"];
        if (input.serviceType && !ALLOWED_SERVICE_TYPES.includes(input.serviceType)) {
          return {
            afterUrl: null,
            status: "skipped" as const,
            error: `Image pipeline not available for service type: ${input.serviceType}`,
          };
        }

        const result = await generateImage({
          prompt:
            "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished bathtub in a real residential bathroom.",
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
          serviceType: z.enum(["bathtub", "shower", "jacuzzi"]).default("bathtub"),
          price: z.number().int().positive(),
          beforeUrl: z.string().min(1),
          afterUrl: z.string().min(1).optional(),
          transformationImageUrl: z.string().url().optional(),
          transformationPrice: z.number().int().positive().optional(),
          bathroomSinkPrice: z.number().int().positive().optional(),
          kitchenSinkPrice: z.number().int().positive().optional(),
          bookingLink: z.string().optional(),
          calendarEmbed: z.string().optional(),
          ghlContactId: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          duration: z.string().optional(),
          notes: z.string().optional(),
          companyName: z.string().optional(),
          companyLogoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const slug = nameToSlug(input.name, input.firstName, input.lastName, input.companyName);

        // Guard: reject data URIs in beforeUrl — only HTTPS URLs are allowed
        if (input.beforeUrl.startsWith("data:")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "beforeUrl must be an HTTPS URL, not a data URI. Upload the image to S3 first." });
        }

        // 1. Use pre-generated afterUrl if provided (from pipeline.testImage),
        //    otherwise generate after image from the before photo (approved services only).
        const ALLOWED_PIPELINE_TYPES = ["bathtub", "shower", "jacuzzi"];
        let afterUrl: string;
        if (input.afterUrl) {
          // Guard: reject data URIs in afterUrl
          if (input.afterUrl.startsWith("data:")) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "afterUrl must be an HTTPS URL, not a data URI." });
          }
          afterUrl = input.afterUrl;
        } else if (ALLOWED_PIPELINE_TYPES.includes(input.serviceType)) {
          const { url: generatedAfterUrl, error: genError } = await generateImage({
            prompt:
              "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished bathtub in a real residential bathroom.",
            originalImages: [{ url: input.beforeUrl }],
          });
          if (!generatedAfterUrl) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Image pipeline failed: ${genError || "no output"}. S3 storage is required.`,
            });
          }
          afterUrl = generatedAfterUrl;
        } else {
          // Unsupported service type — skip pipeline, use before image as placeholder
          console.log(`[estimates.create] Pipeline skipped for service type: ${input.serviceType}`);
          afterUrl = input.beforeUrl;
        }

        // 2. Save estimate to DB
        const estimate = upsertEstimate({
          name: input.name,
          firstName: input.firstName,
          lastName: input.lastName,
          service: input.service,
          serviceType: input.serviceType,
          price: input.price,
          beforeUrl: input.beforeUrl,
          afterUrl,
          transformationImageUrl: input.transformationImageUrl,
          transformationPrice: input.transformationPrice,
          bathroomSinkPrice: input.bathroomSinkPrice,
          kitchenSinkPrice: input.kitchenSinkPrice,
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
          companyName: input.companyName,
          companyLogoUrl: input.companyLogoUrl,
        });
        if (!estimate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save estimate" });

        // 3. Update GHL contact fields (fire-and-log — estimate is already saved)
        if (input.ghlContactId && ENV.ghlApiKey) {
          const origin = ENV.publicUrl;
          const estimatePageUrl = `${origin}/estimate/${slug}`;
          try {
            const customFields: Array<{ key: string; field_value: string }> = [
              { key: "Bp_before_photo", field_value: input.beforeUrl },
              { key: "Bp_after_photo",  field_value: afterUrl },
              { key: "Bp_estimate_url", field_value: estimatePageUrl },
              // State fields for GHL workflow automation
              { key: "bp_estimate_sent", field_value: "true" },
              { key: "bp_estimate_sent_at", field_value: new Date().toISOString() },
              { key: "bp_estimate_viewed", field_value: "false" },
              { key: "bp_appointment_booked", field_value: "false" },
              { key: "bp_customer_name", field_value: input.name },
              ...(input.phone ? [{ key: "bp_customer_phone", field_value: input.phone }] : []),
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

        return { slug, estimate };
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

        // Fire GHL alert for first view
        if (estimate.ghlContactId && ENV.ghlApiKey) {
          try {
            const origin = ENV.publicUrl;
            const estimatePageUrl = `${origin}/estimate/${estimate.slug}`;

            const ghlBody: Record<string, unknown> = {
              customFields: [
                { key: "bp_estimate_viewed", field_value: "true" },
                { key: "bp_estimate_viewed_at", field_value: new Date().toISOString() },
                { key: "Bp_estimate_url", field_value: estimatePageUrl },
              ],
              tags: ["estimate_viewed"],
            };

            const ghlRes = await fetch(
              `https://services.leadconnectorhq.com/contacts/${estimate.ghlContactId}`,
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
              console.warn(`[GHL] Viewed alert failed (${ghlRes.status})${detail ? `: ${detail}` : ""}`);
            } else {
              console.log(`[GHL] Estimate viewed alert sent for ${estimate.name} (${estimate.slug})`);
            }
          } catch (err) {
            console.warn("[GHL] Viewed alert error:", err);
          }
        } else {
          console.log(`[Viewed] ${estimate.name} viewed estimate ${estimate.slug} (no GHL contact linked)`);
        }

        return { alreadyViewed: false };
      }),
  }),
});

export type AppRouter = typeof appRouter;
