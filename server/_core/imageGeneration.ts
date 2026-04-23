/**
 * Image generation using Gemini 3-step transformation pipeline + S3 storage.
 *
 * Pipeline (sequential — each step feeds into the next):
 *   Step 1 — Refinish tub surface
 *   Step 2 — Remove clutter
 *   Step 3 — Light staging
 *
 * After the 3 steps, the final image is uploaded to S3.
 * S3 must be configured — there is no fallback.
 */
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./env";
import { isS3Configured, uploadGeneratedImageToS3 } from "./s3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerateImageOptions = {
  prompt: string; // kept for interface compat — ignored internally; pipeline uses fixed prompts
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
  /** Set when the pipeline fails — human-readable reason */
  error?: string;
};

// ---------------------------------------------------------------------------
// Pipeline step definitions
// ---------------------------------------------------------------------------

const PIPELINE_STEPS = [
  {
    name: "Step 1 — Refinish tub",
    prompt:
      "Take this bathtub and make it appear as a brand new glossy white refinished tub. Do not change the layout, angle, or objects in the image. Only improve the bathtub surface.",
  },
  {
    name: "Step 2 — Remove clutter",
    prompt:
      "Remove any unnecessary clutter such as laundry baskets, bottles, or random items. Do not change the structure, layout, or fixtures. Only remove minor clutter.",
  },
  {
    name: "Step 3 — Light staging",
    prompt:
      "Make the bathroom appear clean and lightly staged for sale. Do not redesign or remodel. Keep everything realistic and consistent with the original image.",
  },
] as const;

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

/**
 * Run a single Gemini image-edit step.
 * Sends the current image + a text prompt and returns the edited image as base64.
 */
async function geminiEditStep(
  client: GoogleGenAI,
  imageBase64: string,
  imageMime: string,
  prompt: string
): Promise<{ b64?: string; mime?: string; error?: string }> {
  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: imageMime,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["image", "text"],
      },
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      return { error: `Gemini returned no candidates` };
    }

    // Look for an inline image part in the response
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return {
          b64: part.inlineData.data,
          mime: part.inlineData.mimeType || "image/png",
        };
      }
    }

    // No image part found — check if there's text explaining why
    const textParts = (candidate.content?.parts ?? [])
      .filter((p: any) => p.text)
      .map((p: any) => p.text)
      .join(" ");

    return { error: `Gemini returned no image data${textParts ? `. Response: ${textParts.slice(0, 200)}` : ""}` };
  } catch (err: any) {
    return { error: `Gemini API error: ${err?.message || String(err)}` };
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    console.warn("[generateImage] GEMINI_API_KEY is not configured — skipping image generation");
    return { error: "GEMINI_API_KEY is not configured on the server" };
  }

  // Resolve input image to base64
  const original = options.originalImages?.[0];
  let currentB64: string | undefined;
  let currentMime: string = "image/png";

  if (original?.b64Json) {
    currentB64 = original.b64Json;
    currentMime = original.mimeType || "image/png";
  } else if (original?.url) {
    // Only fetch from EstiClose-owned S3 URLs — never third-party
    try {
      const imgRes = await fetch(original.url);
      if (!imgRes.ok) {
        return { error: `Could not fetch image from owned storage (${imgRes.status})` };
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      currentB64 = buf.toString("base64");
      currentMime = imgRes.headers.get("content-type") || "image/jpeg";
    } catch (err: any) {
      return { error: `Failed to fetch from owned storage: ${err?.message || String(err)}` };
    }
  }

  if (!currentB64) {
    return { error: "No input image provided" };
  }

  // Initialize Gemini client
  const genAI = new GoogleGenAI({ apiKey });

  // ------------------------------------------------------------------
  // Run 3-step pipeline sequentially
  // ------------------------------------------------------------------
  for (const step of PIPELINE_STEPS) {
    console.log(`[generateImage] ${step.name} — started (inputSize=${currentB64!.length} chars, mime=${currentMime})`);

    const result = await geminiEditStep(genAI, currentB64!, currentMime, step.prompt);

    if (result.error || !result.b64) {
      const errorMsg = `${step.name} failed: ${result.error || "no image returned"}`;
      console.error(`[generateImage] ${errorMsg}`);
      return { error: errorMsg };
    }

    currentB64 = result.b64;
    currentMime = result.mime || "image/png";
    console.log(`[generateImage] ${step.name} — completed (outputSize=${currentB64.length} chars)`);
  }

  // ------------------------------------------------------------------
  // Upload to S3 — no fallback; S3 must be configured
  // ------------------------------------------------------------------
  if (!isS3Configured()) {
    return { error: "S3 storage is not configured. Cannot store generated image. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME." };
  }

  try {
    const imageBuffer = Buffer.from(currentB64!, "base64");
    const { url } = await uploadGeneratedImageToS3({
      buffer: imageBuffer,
      contentType: currentMime,
    });
    console.log(`[generateImage] Uploaded to S3: ${url}`);
    return { url };
  } catch (err: any) {
    const errMsg = `S3 upload failed: ${err?.message || String(err)}`;
    console.error(`[generateImage] ${errMsg}`);
    return { error: errMsg };
  }
}
