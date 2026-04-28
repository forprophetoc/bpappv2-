/**
 * Image generation using a single Gemini API call + S3 storage.
 *
 * One call handles refinishing + clutter removal in a single prompt.
 * The result is uploaded to S3. S3 must be configured — there is no fallback.
 */
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./env";
import { isS3Configured, uploadGeneratedImageToS3 } from "./s3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerateImageOptions = {
  prompt: string; // kept for interface compat — ignored internally; pipeline uses fixed prompt
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
// Single combined prompt
// ---------------------------------------------------------------------------

const REFINISH_PROMPT =
  "Refinish this bathtub to look brand new with a glossy, smooth, professional white finish. " +
  "If there is any clutter such as bottles, laundry baskets, or random items near the tub, remove it. " +
  "Do not change the bathroom layout, camera angle, fixtures, or lighting. " +
  "Do not redesign or remodel the bathroom. " +
  "Keep everything realistic and consistent with the original photo.";

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
  let inputB64: string | undefined;
  let inputMime: string = "image/png";

  if (original?.b64Json) {
    inputB64 = original.b64Json;
    inputMime = original.mimeType || "image/png";
  } else if (original?.url) {
    // Only fetch from EstiClose-owned S3 URLs — never third-party
    try {
      const imgRes = await fetch(original.url);
      if (!imgRes.ok) {
        return { error: `Could not fetch image from owned storage (${imgRes.status})` };
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      inputB64 = buf.toString("base64");
      inputMime = imgRes.headers.get("content-type") || "image/jpeg";
    } catch (err: any) {
      return { error: `Failed to fetch from owned storage: ${err?.message || String(err)}` };
    }
  }

  if (!inputB64) {
    return { error: "No input image provided" };
  }

  // Single Gemini API call
  const genAI = new GoogleGenAI({ apiKey });

  console.log(`[generateImage] Starting (inputSize=${inputB64.length} chars, mime=${inputMime})`);

  let outputB64: string;
  let outputMime: string;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        {
          role: "user",
          parts: [
            { text: REFINISH_PROMPT },
            {
              inlineData: {
                data: inputB64,
                mimeType: inputMime,
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
      return { error: "Gemini returned no candidates" };
    }

    // Look for an inline image part in the response
    let foundImage = false;
    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        outputB64 = part.inlineData.data;
        outputMime = part.inlineData.mimeType || "image/png";
        foundImage = true;
        break;
      }
    }

    if (!foundImage!) {
      const textParts = (candidate.content?.parts ?? [])
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(" ");
      return { error: `Gemini returned no image data${textParts ? `. Response: ${textParts.slice(0, 200)}` : ""}` };
    }
  } catch (err: any) {
    return { error: `Gemini API error: ${err?.message || String(err)}` };
  }

  console.log(`[generateImage] Completed (outputSize=${outputB64!.length} chars)`);

  // ------------------------------------------------------------------
  // Upload to S3 — no fallback; S3 must be configured
  // ------------------------------------------------------------------
  if (!isS3Configured()) {
    return { error: "S3 storage is not configured. Cannot store generated image. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and S3_BUCKET_NAME." };
  }

  try {
    const imageBuffer = Buffer.from(outputB64!, "base64");
    const { url } = await uploadGeneratedImageToS3({
      buffer: imageBuffer,
      contentType: outputMime!,
    });
    console.log(`[generateImage] Uploaded to S3: ${url}`);
    return { url };
  } catch (err: any) {
    const errMsg = `S3 upload failed: ${err?.message || String(err)}`;
    console.error(`[generateImage] ${errMsg}`);
    return { error: errMsg };
  }
}
