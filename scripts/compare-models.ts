/**
 * Multi-service model comparison script.
 * Runs each service prompt (verbatim from imageGeneration.ts) × each working
 * Gemini image-editing model, saving outputs for side-by-side comparison.
 *
 * Usage: pnpm tsx scripts/compare-models.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// ── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(__dirname, "comparison-output");
const BUDGET_CAP = 2.0;

// ── Read prompts VERBATIM from imageGeneration.ts ───────────────────────────

const imageGenSource = fs.readFileSync(
  path.join(PROJECT_ROOT, "server", "_core", "imageGeneration.ts"),
  "utf-8"
);

function extractPrompt(key: string): string {
  // Match:  key: "...",  or  key: "..."  (last entry, no trailing comma)
  const regex = new RegExp(`${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
  const match = imageGenSource.match(regex);
  if (!match) {
    console.error(`FATAL: Could not extract "${key}" prompt from imageGeneration.ts`);
    process.exit(1);
  }
  return match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n");
}

// ── Test cases: service key → before image path ─────────────────────────────

const TEST_CASES = [
  {
    name: "bathtub",
    promptKey: "bathtub",
    imagePath: path.join(PROJECT_ROOT, "image4.jpeg"),
  },
  {
    name: "tub_tile",
    promptKey: "tub_tile",
    imagePath: path.join(PROJECT_ROOT, "image3.jpeg"),
  },
  {
    name: "jacuzzi",
    promptKey: "jacuzzi",
    imagePath: path.join(PROJECT_ROOT, "image2.jpeg"),
  },
];

// ── Models (only the two that returned 200 in the previous run) ─────────────

const MODELS = [
  { id: "gemini-2.5-flash-image", cost: 0.025, note: "2.5 Flash Image (current prod)" },
  { id: "gemini-3-pro-image-preview", cost: 0.134, note: "Gemini 3 Pro Image Preview" },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("FATAL: GEMINI_API_KEY not set. Export it or add to .env");
    process.exit(1);
  }

  // Validate all input images upfront
  for (const tc of TEST_CASES) {
    if (!fs.existsSync(tc.imagePath)) {
      console.error(`FATAL: Missing before image for "${tc.name}"`);
      console.error(`  Expected at: ${tc.imagePath}`);
      console.error(`  Drop the file there and re-run.`);
      process.exit(1);
    }
  }

  // Extract and display prompts
  const prompts: Record<string, string> = {};
  console.log("\n" + "═".repeat(80));
  console.log("PROMPTS (verbatim from imageGeneration.ts)");
  console.log("═".repeat(80));
  for (const tc of TEST_CASES) {
    prompts[tc.promptKey] = extractPrompt(tc.promptKey);
    console.log(`\n[${tc.promptKey}] (first 100 chars):`);
    console.log(`  "${prompts[tc.promptKey].slice(0, 100)}…"`);
  }

  // Load images
  const images: Record<string, { base64: string; mime: string; sizeKB: number }> = {};
  console.log("\n" + "═".repeat(80));
  console.log("INPUT IMAGES");
  console.log("═".repeat(80));
  for (const tc of TEST_CASES) {
    const buf = fs.readFileSync(tc.imagePath);
    const ext = path.extname(tc.imagePath).toLowerCase();
    const mime = ext === ".png" ? "image/png" : "image/jpeg";
    images[tc.name] = { base64: buf.toString("base64"), mime, sizeKB: buf.length / 1024 };
    console.log(`  ${tc.name}: ${tc.imagePath} (${images[tc.name].sizeKB.toFixed(1)} KB)`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const genAI = new GoogleGenAI({ apiKey });

  type Result = {
    testCase: string;
    model: string;
    note: string;
    success: boolean;
    error?: string;
    timeMs: number;
    cost: number;
  };
  const results: Result[] = [];
  let totalCost = 0;

  // ── Run test matrix ─────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(80));
  console.log("RUNNING TEST MATRIX");
  console.log("═".repeat(80));

  for (const tc of TEST_CASES) {
    for (const model of MODELS) {
      const label = `${tc.name} × ${model.id}`;

      // Budget check
      if (totalCost + model.cost > BUDGET_CAP) {
        console.log(`\n⛔ BUDGET CAP ($${BUDGET_CAP}) would be exceeded. Stopping before ${label}.`);
        results.push({
          testCase: tc.name,
          model: model.id,
          note: model.note,
          success: false,
          error: "Skipped — budget cap exceeded",
          timeMs: 0,
          cost: 0,
        });
        continue;
      }

      const safeFilename = `${tc.name}-${model.id.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const prompt = prompts[tc.promptKey];
      const img = images[tc.name];

      console.log(`\n▶ ${label}…`);

      const start = Date.now();
      try {
        const response = await genAI.models.generateContent({
          model: model.id,
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    data: img.base64,
                    mimeType: img.mime,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["image", "text"],
          },
        });

        const elapsed = Date.now() - start;
        const candidate = response.candidates?.[0];

        if (!candidate) {
          console.log(`  ❌ No candidates (${elapsed}ms)`);
          totalCost += model.cost;
          results.push({ testCase: tc.name, model: model.id, note: model.note, success: false, error: "No candidates returned", timeMs: elapsed, cost: model.cost });
          continue;
        }

        let foundImage = false;
        for (const part of candidate.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const ext = (part.inlineData.mimeType || "image/png").includes("jpeg") ? "jpg" : "png";
            const outPath = path.join(OUTPUT_DIR, `${safeFilename}.${ext}`);
            fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, "base64"));
            console.log(`  ✅ Success (${elapsed}ms) → ${outPath}`);
            foundImage = true;
            break;
          }
        }

        if (!foundImage) {
          const textParts = (candidate.content?.parts ?? [])
            .filter((p: any) => p.text)
            .map((p: any) => p.text)
            .join(" ")
            .slice(0, 200);
          console.log(`  ❌ No image data (${elapsed}ms). Text: ${textParts || "(none)"}`);
          totalCost += model.cost;
          results.push({ testCase: tc.name, model: model.id, note: model.note, success: false, error: `No image. Text: ${textParts || "(none)"}`, timeMs: elapsed, cost: model.cost });
          continue;
        }

        totalCost += model.cost;
        results.push({ testCase: tc.name, model: model.id, note: model.note, success: true, timeMs: elapsed, cost: model.cost });
      } catch (err: any) {
        const elapsed = Date.now() - start;
        const msg = (err?.message || String(err)).slice(0, 200);
        console.log(`  ❌ Error (${elapsed}ms): ${msg}`);

        const isFreeError = msg.includes("not found") || msg.includes("404") || msg.includes("permission") || msg.includes("403");
        if (!isFreeError) totalCost += model.cost;

        results.push({ testCase: tc.name, model: model.id, note: model.note, success: false, error: msg, timeMs: elapsed, cost: isFreeError ? 0 : model.cost });
      }

      console.log(`  Running total: $${totalCost.toFixed(3)}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log("\n\n" + "═".repeat(90));
  console.log("SUMMARY");
  console.log("═".repeat(90));
  console.log(`${"Test Case".padEnd(12)} ${"Model".padEnd(35)} ${"Status".padEnd(10)} ${"Time".padEnd(10)} ${"Cost".padEnd(8)}`);
  console.log("─".repeat(90));
  for (const r of results) {
    const status = r.success ? "✅ OK" : "❌ FAIL";
    const time = r.timeMs ? `${(r.timeMs / 1000).toFixed(1)}s` : "—";
    const cost = `$${r.cost.toFixed(3)}`;
    console.log(`${r.testCase.padEnd(12)} ${r.model.padEnd(35)} ${status.padEnd(10)} ${time.padEnd(10)} ${cost.padEnd(8)}`);
    if (r.error) console.log(`             → ${r.error.slice(0, 100)}`);
  }
  console.log("─".repeat(90));
  console.log(`Total estimated cost: $${totalCost.toFixed(3)}`);
  console.log(`Output folder: ${OUTPUT_DIR}`);
  console.log("═".repeat(90));
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
