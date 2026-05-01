import { GoogleGenAI } from "@google/genai";
import { ENV } from "./env";
import { isS3Configured, uploadGeneratedImageToS3 } from "./s3";

const IMAGE_MODEL = "gemini-3-pro-image-preview";

export type GenerateImageOptions = {
  prompt: string;
  serviceType?: string;
  originalImages?: Array<{
    url?: string;
    b64Json?: string;
    mimeType?: string;
  }>;
};

export type GenerateImageResponse = {
  url?: string;
  error?: string;
};

const PROMPTS: Record<string, string> = {
  bathtub: "make this tub appear as if it was just refinished in glossy white. remove any clutter if visible. stage with a roll of folded towels. do not change size or perspective.",
  shower: "make this shower pan, shower floor, and wall tile appear as if it was just refinished in glossy white. remove any clutter if visible. do not change size or perspective.",
  jacuzzi: "Refinish every visible square inch of the soaking tub structure, including the complete interior basin, the continuous exterior front apron panel, all side skirt panels, and the integrated rear backsplash shelf, into a single, seamless, brilliant monochromatic glossy snow white. All existing surface colors (e.g., biscuit, beige, off-white) must be completely covered and eliminated by a thick, opaque white coating that renders the entire assembly as a single, unified, and flawlessly reflective white geometric unit. Ensure the new white finish is dramatically brighter than any original non-white surface. Keep all camera angles, framing, perspectives, and existing fixtures identical to the original photo. Remove all toiletries and clutter. Place one roll of decorative towels on the tub corner for staging. Do not introduce new furniture, vanities, or architectural elements.",
  tub_tile: "Professionally refinish the bathtub and all three surrounding wall surfaces to a flawless, uniform, monochromatic brilliant white high-gloss finish. All existing visual patterns, mosaic details, surface texture, or visual variations (including all non-solid colors and non-solid visual textures) present on the wall tiles and tub surface must be completely covered over and eliminated, appearing as a perfectly smooth, monochromatic white plane. Only the physical substrate structure of the tiles and grout lines should be visible beneath the coating, ensuring the original geometric layout is preserved, but all visual patterns are invisible. Do not introduce any new objects or expand the perspective. Remove all visible toiletries and clutter. Add a stack of decorative towels for staging. Maintain the original camera perspective, fixtures, and framing exactly.",
};

export async function generateImage(
  options: GenerateImageOptions
): Promise<GenerateImageResponse> {
  const apiKey = ENV.geminiApiKey;
  if (!apiKey) {
    console.warn("[generateImage] GEMINI_API_KEY is not configured — skipping image generation");
    return { error: "GEMINI_API_KEY is not configured on the server" };
  }

  const vertical = options.serviceType || "bathtub";
  const prompt = PROMPTS[vertical];
  if (!prompt) {
    return { error: "Unsupported service type for image generation" };
  }

  console.log(`[generateImage] Using single-step prompt for vertical: ${vertical}`);

  // Resolve input image to base64
  const original = options.originalImages?.[0];
  let imageB64: string | undefined;
  let imageMime: string = "image/png";

  if (original?.b64Json) {
    imageB64 = original.b64Json;
    imageMime = original.mimeType || "image/png";
  } else if (original?.url) {
    try {
      const imgRes = await fetch(original.url);
      if (!imgRes.ok) {
        return { error: `Could not fetch before image from URL (${imgRes.status})` };
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      imageB64 = buf.toString("base64");
      imageMime = imgRes.headers.get("content-type") || "image/jpeg";
    } catch (err: any) {
      return { error: `Failed to fetch before image: ${err?.message || String(err)}` };
    }
  }

  if (!imageB64) {
    return { error: "No input image provided" };
  }

  // Single Gemini call
  const genAI = new GoogleGenAI({ apiKey });

  try {
    const response = await genAI.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageB64,
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
      return { error: "Gemini returned no candidates" };
    }

    let resultB64: string | undefined;
    let resultMime: string = "image/png";

    for (const part of candidate.content?.parts ?? []) {
      if (part.inlineData?.data) {
        resultB64 = part.inlineData.data;
        resultMime = part.inlineData.mimeType || "image/png";
        break;
      }
    }

    if (!resultB64) {
      const textParts = (candidate.content?.parts ?? [])
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join(" ");
      return { error: `Gemini returned no image data${textParts ? `. Response: ${textParts.slice(0, 200)}` : ""}` };
    }

    // Upload to S3 or fall back to data URI
    if (isS3Configured()) {
      try {
        const imageBuffer = Buffer.from(resultB64, "base64");
        const { url } = await uploadGeneratedImageToS3({
          buffer: imageBuffer,
          contentType: resultMime,
        });
        console.log(`[generateImage] Uploaded to S3: ${url}`);
        return { url };
      } catch (err) {
        console.error("[generateImage] S3 upload failed, falling back to data URI:", err);
      }
    }

    return { url: `data:${resultMime};base64,${resultB64}` };
  } catch (err: any) {
    return { error: `Gemini API error: ${err?.message || String(err)}` };
  }
}
