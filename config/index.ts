/**
 * Config loader — resolves company config by slug.
 * Uses a static registry to avoid dynamic require issues with tsx/ESM.
 * To add a new company: import its config and add to the registry.
 */
import fs from "fs";
import path from "path";
import type { CompanyConfig } from "./types";
import bathtubPros from "./bathtub-pros";

/** Registry of all company configs keyed by slug */
const configs: Record<string, CompanyConfig> = {
  "bathtub-pros": bathtubPros,
};

/**
 * Load dev configs from config/dev/*.json at startup.
 * These are test configs created via the dev onboarding pipeline.
 */
function loadDevConfigs() {
  const devDir = path.resolve(import.meta.dirname, "dev");
  if (!fs.existsSync(devDir)) return;
  const files = fs.readdirSync(devDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(devDir, file), "utf-8");
      const config = JSON.parse(content) as CompanyConfig;
      if (config.company?.slug) {
        configs[config.company.slug] = config;
      }
    } catch (_e) {
      // Skip invalid config files
    }
  }
}

// Load dev configs on module initialization
loadDevConfigs();

/**
 * Register a config at runtime (used by dev onboarding pipeline).
 */
export function registerConfig(slug: string, config: CompanyConfig): void {
  configs[slug] = config;
}

/**
 * Load a company config by slug.
 * Returns null if no config exists for the given slug.
 */
export function getCompanyConfig(slug: string): CompanyConfig | null {
  return configs[slug] || null;
}

/**
 * List all available company slugs.
 */
export function listCompanySlugs(): string[] {
  return Object.keys(configs);
}

export type { CompanyConfig } from "./types";
