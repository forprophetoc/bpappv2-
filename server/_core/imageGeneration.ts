/**
 * Image generation using Gemini 3-step transformation pipeline + optional S3 storage.
 *
 * Pipeline (sequential — each step feeds into the next):
 *   Step 1 — Refinish tub surface
 *   Step 2 — Remove clutter
 *   Step 3 — Light staging
 *
 * After the 3 steps, the final image is:
 *   1. Uploaded to S3 if configured → returns hosted URL
 *   2. Otherwise returned as an inline data URI
 */
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./env";
import { isS3Configured, uploadGeneratedImageToS3 } from "./s3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenerateImageOptions = {
  prompt: string;
  serviceType?: string;
  baseColor?: string;
  flakeColor?: string;
  upperCabinetColor?: string;
  lowerCabinetColor?: string;
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

type PipelineStep = { name: string; prompt: string };

const BATHTUB_STEPS: PipelineStep[] = [
  {
    name: "Step 1 — Refinish tub",
    prompt:
      "make this tub appear as if it was just refinished in a shiny, glossy white. remove clutter from tub area. do not change size or perspective. do not add anything to the bathtub, do not duplicate drain covers.",
  },
];

const TUB_TILE_STEPS: PipelineStep[] = [
  {
    name: "Step 1 — Refinish tub & tile",
    prompt:
      "make this tub and surrounding tile appear as if it was just refinished in a shiny, glossy white. remove clutter from tub area. do not change size or perspective. do not add anything to the bathtub, do not duplicate drain covers.",
  },
];

function getEpoxySteps(baseColor?: string, flakeColor?: string): PipelineStep[] {
  const colorMap: Record<string, string> = {
    "light-gray": "light gray",
    "dark-gray": "dark gray",
    "tan": "tan",
    "earth-tone": "earth tone brown",
    "custom": "neutral gray",
  };
  const baseDesc = baseColor ? (colorMap[baseColor] || baseColor.replace("-", " ")) : "gray";

  return [
    {
      name: "Step 1 — Apply epoxy coating",
      prompt:
        `This is a photo of a real floor. Coat the floor with a ${baseDesc} epoxy finish. The coating should look like a real professionally applied epoxy floor — smooth, solid color, subtle sheen. Add very small, fine, tight paint chip flakes typical of a real epoxy flake floor. The flakes should be tiny, dense, and subtle — not large, not scattered, not exaggerated. Keep everything else in the photo exactly the same — same walls, same angle, same lighting. Only change the floor surface.`,
    },
    {
      name: "Step 2 — Remove clutter",
      prompt:
        "Remove any unnecessary clutter such as boxes, tools, or random items from the floor area. Do not change the structure, layout, walls, or doors. Do not add furniture or stage the space. Only remove minor clutter.",
    },
  ];
}

function getCabinetSteps(upperColor?: string, lowerColor?: string): PipelineStep[] {
  const upperDesc = upperColor || "white";
  const lowerDesc = lowerColor || "white";
  const sameColor = upperDesc === lowerDesc;

  const colorInstruction = sameColor
    ? `Repaint ALL cabinets (upper and lower) in ${upperDesc}. `
    : `Repaint UPPER cabinets in ${upperDesc}. Repaint LOWER cabinets in ${lowerDesc}. `;

  return [
    {
      name: "Step 1 — Refinish cabinets",
      prompt:
        `Create a realistic cabinet refinishing transformation of this exact kitchen photo. ${colorInstruction}The finish must look professionally sprayed — smooth, even, no brush marks. Do NOT change the layout, countertops, backsplash, appliances, lighting, or camera angle. Only modify cabinet door and drawer surfaces. Preserve shadows, reflections, and lighting. This is a refinish, not a remodel or redesign.`,
    },
    {
      name: "Step 2 — Clean up",
      prompt:
        "Remove any unnecessary clutter from the kitchen counters and surfaces. Do not change the structure, layout, cabinets, or fixtures. Do not add furniture or stage the space. Only remove minor clutter.",
    },
  ];
}

function getPipelineSteps(serviceType?: string, baseColor?: string, flakeColor?: string, upperCabinetColor?: string, lowerCabinetColor?: string): PipelineStep[] {
  if (serviceType === "tub_tile") return TUB_TILE_STEPS;
  if (serviceType === "epoxy") return getEpoxySteps(baseColor, flakeColor);
  if (serviceType === "cabinet") return getCabinetSteps(upperCabinetColor, lowerCabinetColor);
  return BATHTUB_STEPS;
}

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
    try {
      const imgRes = await fetch(original.url);
      if (!imgRes.ok) {
        return { error: `Could not fetch before image from URL (${imgRes.status})` };
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      currentB64 = buf.toString("base64");
      currentMime = imgRes.headers.get("content-type") || "image/jpeg";
    } catch (err: any) {
      return { error: `Failed to fetch before image: ${err?.message || String(err)}` };
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
  const steps = getPipelineSteps(options.serviceType, options.baseColor, options.flakeColor, options.upperCabinetColor, options.lowerCabinetColor);
  for (const step of steps) {
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
  // Upload to S3 or fall back to data URI
  // ------------------------------------------------------------------
  if (isS3Configured()) {
    try {
      const imageBuffer = Buffer.from(currentB64!, "base64");
      const { url } = await uploadGeneratedImageToS3({
        buffer: imageBuffer,
        contentType: currentMime,
      });
      console.log(`[generateImage] Uploaded to S3: ${url}`);
      return { url };
    } catch (err) {
      console.error("[generateImage] S3 upload failed, falling back to data URI:", err);
    }
  } else {
    console.warn("[generateImage] S3 not configured — returning inline data URI (compressed)");
  }

  // Compress the data URI to reduce storage/transfer size
  // Re-encode as JPEG if it isn't already to save space
  if (currentMime !== "image/jpeg") {
    currentMime = "image/png";
  }
  return { url: `data:${currentMime};base64,${currentB64}` };
}
