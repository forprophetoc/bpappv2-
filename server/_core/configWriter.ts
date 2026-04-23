import fs from "fs";
import path from "path";
import type { BrandConfig } from "../../shared/brandConfig";

/**
 * Directory where per-company config JSON files are stored.
 * Each company gets a file: configs/{slug}.json
 *
 * CONFIGS_DIR env var allows sharing a single configs directory across
 * V3, bathtubappv2, and staging deployments.
 */
const CONFIGS_DIR = process.env.CONFIGS_DIR
  ? path.resolve(process.env.CONFIGS_DIR)
  : path.resolve(import.meta.dirname, "../../configs");

/** Ensure the configs directory exists. */
function ensureConfigsDir() {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }
}

/** Slugify a company name for use as a filename. */
export function companySlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-");
}

/**
 * Write a company brand config to disk as JSON.
 * Returns the absolute path and the slug used.
 */
export function writeCompanyConfig(config: BrandConfig): {
  slug: string;
  filePath: string;
} {
  ensureConfigsDir();
  const slug = companySlug(config.companyName);
  const filePath = path.join(CONFIGS_DIR, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`[ConfigWriter] Wrote config for "${config.companyName}" → ${filePath}`);
  return { slug, filePath };
}

/**
 * Read a company config from disk by slug. Returns null if not found.
 */
export function readCompanyConfig(slug: string): BrandConfig | null {
  const filePath = path.join(CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as BrandConfig;
}

/**
 * List all company config slugs that exist on disk.
 */
export function listCompanyConfigs(): string[] {
  ensureConfigsDir();
  return fs
    .readdirSync(CONFIGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}
