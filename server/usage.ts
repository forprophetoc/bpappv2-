import fs from "fs";
import path from "path";

const USAGE_DIR = path.resolve(import.meta.dirname, "..", "data", "usage");

interface UsageData {
  image_count: number;
  last_updated: string;
}

function usagePath(slug: string): string {
  return path.join(USAGE_DIR, `${slug}.json`);
}

export function getUsage(slug: string): UsageData {
  const filePath = usagePath(slug);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as UsageData;
  } catch {
    return { image_count: 0, last_updated: "" };
  }
}

export function incrementUsage(slug: string): UsageData {
  fs.mkdirSync(USAGE_DIR, { recursive: true });
  const current = getUsage(slug);
  const updated: UsageData = {
    image_count: current.image_count + 1,
    last_updated: new Date().toISOString(),
  };
  const filePath = usagePath(slug);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(updated, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
  return updated;
}
