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
import { COMPANY } from "../esticlose.config";

export const appRouter = router({
  system: systemRouter,

  pipeline: router({
    keyStatus: publicProcedure.query(() => {
      return {
        gemini: !!ENV.geminiApiKey,
        s3: !!(ENV.awsAccessKeyId && ENV.awsSecretAccessKey && ENV.awsBucketName),
      };
    }),

    testImage: publicProcedure
      .input(
        z.object({
          imageBase64: z.string().min(1),
          mimeType: z.string().default("image/png"),
          serviceType: z.string().optional(),
          baseColor: z.string().optional(),
          flakeColor: z.string().optional(),
          upperCabinetColor: z.string().optional(),
          lowerCabinetColor: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const ALLOWED_SERVICE_TYPES = ["bathtub", "shower", "jacuzzi", "cabinet"]; // epoxy shelved
        if (input.serviceType && !ALLOWED_SERVICE_TYPES.includes(input.serviceType)) {
          return {
            afterUrl: null,
            status: "skipped" as const,
            error: `Image pipeline not available for service type: ${input.serviceType}`,
          };
        }

        const prompts: Record<string, string> = {
          bathtub: "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished bathtub in a real residential bathroom.",
          shower: "Refinish this shower to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished shower in a real residential bathroom.",
          jacuzzi: "Refinish this soaking tub / jacuzzi to look brand new with a glossy, smooth, professional white finish. Refinish the entire visible surface including the inside basin, the outside apron, and any surrounding backsplash or ledge areas. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear from all surfaces. The result should look like a fully refinished soaking tub with every visible surface restored in a real residential bathroom.",
          epoxy: "Apply a professional epoxy floor coating to this garage or residential floor. Show a smooth, glossy, seamless epoxy finish with decorative color flakes evenly distributed across the surface. Keep the same perspective, lighting, and surroundings. Remove stains, cracks, and imperfections. The result should look like a freshly coated professional epoxy floor in a real residential setting.",
          cabinet: "Refinish the cabinets in this kitchen photo to look professionally sprayed with a smooth, even finish. Keep the same layout, countertops, backsplash, appliances, lighting, and camera angle. Only modify cabinet surfaces.",
        };
        const prompt = prompts[input.serviceType || "bathtub"] || prompts.bathtub;

        const result = await generateImage({
          prompt,
          serviceType: input.serviceType || "bathtub",
          baseColor: input.baseColor,
          flakeColor: input.flakeColor,
          upperCabinetColor: input.upperCabinetColor,
          lowerCabinetColor: input.lowerCabinetColor,
          originalImages: [{ b64Json: input.imageBase64, mimeType: input.mimeType }],
        });
        if (!result.url) {
          return {
            afterUrl: null,
            status: "failed" as const,
            error: result.error || "Image generation failed — no output",
          };
        }
        return {
          afterUrl: result.url,
          status: "success" as const,
          error: null,
        };
      }),

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
    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          service: z.string().min(1),
          serviceType: z.enum(["bathtub", "shower", "jacuzzi", "cabinet"]).default("bathtub"), // epoxy shelved
          price: z.number().int().positive(),
          beforeUrl: z.string().min(1),
          afterUrl: z.string().min(1).optional(),
          transformationImageUrl: z.string().url().optional(),
          transformationPrice: z.number().int().positive().optional(),
          bathroomSinkPrice: z.number().int().positive().optional(),
          kitchenSinkPrice: z.number().int().positive().optional(),
          baseColor: z.string().optional(),
          flakeColor: z.string().optional(),
          maintenancePlanPrice: z.number().int().positive().optional(),
          uvClearCoatPrice: z.number().int().positive().optional(),
          upperCabinetColor: z.string().optional(),
          lowerCabinetColor: z.string().optional(),
          softCloseHingeUpgrade: z.number().int().positive().optional(),
          hardwareReplacement: z.number().int().positive().optional(),
          hardwareUpgrade: z.number().int().positive().optional(),
          bookingLink: z.string().optional(),
          calendarEmbed: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          duration: z.string().optional(),
          notes: z.string().optional(),
          companyName: z.string().optional(),
          companyLogoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const companyName = input.companyName || COMPANY.name;
        const slug = nameToSlug(input.name, input.firstName, input.lastName, companyName);

        const ALLOWED_PIPELINE_TYPES = ["bathtub", "shower", "jacuzzi", "cabinet"]; // epoxy shelved
        let afterUrl: string;
        if (input.afterUrl) {
          afterUrl = input.afterUrl;
        } else if (ALLOWED_PIPELINE_TYPES.includes(input.serviceType)) {
          const createPrompts: Record<string, string> = {
            bathtub: "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished bathtub in a real residential bathroom.",
            shower: "Refinish this shower to look brand new with a glossy, smooth, professional white finish. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear. The result should look like a freshly refinished shower in a real residential bathroom.",
            jacuzzi: "Refinish this soaking tub / jacuzzi to look brand new with a glossy, smooth, professional white finish. Refinish the entire visible surface including the inside basin, the outside apron, and any surrounding backsplash or ledge areas. Keep the same perspective, lighting, and surroundings. Remove stains, chips, discoloration, and wear from all surfaces. The result should look like a fully refinished soaking tub with every visible surface restored in a real residential bathroom.",
            epoxy: "Apply a professional epoxy floor coating to this garage or residential floor. Show a smooth, glossy, seamless epoxy finish with decorative color flakes evenly distributed across the surface. Keep the same perspective, lighting, and surroundings. Remove stains, cracks, and imperfections. The result should look like a freshly coated professional epoxy floor in a real residential setting.",
            cabinet: "Refinish the cabinets in this kitchen photo to look professionally sprayed with a smooth, even finish. Keep the same layout, countertops, backsplash, appliances, lighting, and camera angle. Only modify cabinet surfaces.",
          };
          const createPrompt = createPrompts[input.serviceType] || createPrompts.bathtub;

          const { url: generatedAfterUrl, error: genError } = await generateImage({
            prompt: createPrompt,
            serviceType: input.serviceType,
            upperCabinetColor: input.upperCabinetColor,
            lowerCabinetColor: input.lowerCabinetColor,
            originalImages: [{ url: input.beforeUrl }],
          });
          if (!generatedAfterUrl) {
            console.warn(`[estimates.create] Image generation failed — using beforeUrl as afterUrl fallback${genError ? `: ${genError}` : ""}`);
          }
          afterUrl = generatedAfterUrl ?? input.beforeUrl;
        } else {
          console.log(`[estimates.create] Pipeline skipped for service type: ${input.serviceType}`);
          afterUrl = input.beforeUrl;
        }

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
          baseColor: input.baseColor,
          flakeColor: input.flakeColor,
          maintenancePlanPrice: input.maintenancePlanPrice,
          uvClearCoatPrice: input.uvClearCoatPrice,
          upperCabinetColor: input.upperCabinetColor,
          lowerCabinetColor: input.lowerCabinetColor,
          softCloseHingeUpgrade: input.softCloseHingeUpgrade,
          hardwareReplacement: input.hardwareReplacement,
          hardwareUpgrade: input.hardwareUpgrade,
          bookingLink: input.bookingLink || COMPANY.bookingLink || undefined,
          calendarEmbed: input.calendarEmbed,
          slug,
          email: input.email,
          phone: input.phone,
          address: input.address,
          duration: input.duration || "3 Hours",
          notes: input.notes,
          status: "New Lead",
          companyName,
          companyLogoUrl: input.companyLogoUrl || COMPANY.logoUrl || undefined,
        });
        if (!estimate) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save estimate" });

        return { slug, estimate };
      }),

    list: publicProcedure.query(() => {
      const all = getAllEstimates();
      // Strip heavy image data from list responses to keep payloads small
      return all.map(({ beforeUrl, afterUrl, transformationImageUrl, calendarEmbed, ...rest }) => ({
        ...rest,
        beforeUrl: beforeUrl?.startsWith("data:") ? "" : beforeUrl,
        afterUrl: afterUrl?.startsWith("data:") ? "" : afterUrl,
        transformationImageUrl: transformationImageUrl?.startsWith("data:") ? "" : transformationImageUrl,
        calendarEmbed: null,
      }));
    }),

    updateStatus: publicProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["New Lead", "Estimate Sent", "Appointment Booked", "Completed"]),
      }))
      .mutation(async ({ input }) => {
        updateEstimateStatus(input.id, input.status);
        return { success: true };
      }),

    bySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .query(async ({ input }) => {
        const estimate = getEstimateBySlug(input.slug);
        if (!estimate) throw new TRPCError({ code: "NOT_FOUND", message: "Estimate not found" });
        // Replace data URIs with image endpoint URLs to keep JSON response small
        return {
          ...estimate,
          beforeUrl: estimate.beforeUrl?.startsWith("data:") ? `/api/image/${input.slug}/beforeUrl` : estimate.beforeUrl,
          afterUrl: estimate.afterUrl?.startsWith("data:") ? `/api/image/${input.slug}/afterUrl` : estimate.afterUrl,
        };
      }),

    markViewed: publicProcedure
      .input(z.object({ slug: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const { alreadyViewed, estimate } = markEstimateViewed(input.slug);
        if (alreadyViewed || !estimate) {
          return { alreadyViewed: true };
        }
        console.log(`[Viewed] ${estimate.name} viewed estimate ${estimate.slug}`);
        return { alreadyViewed: false };
      }),
  }),
});

export type AppRouter = typeof appRouter;
