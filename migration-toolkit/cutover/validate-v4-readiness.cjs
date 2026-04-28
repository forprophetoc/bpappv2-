#!/usr/bin/env node
/**
 * EstiClose Cutover — V4 Readiness Validator
 *
 * Checks whether a V4 deployment directory has everything needed to go live:
 * environment variables, database, config files, required folders.
 *
 * Usage:
 *   node validate-v4-readiness.cjs <path-to-v4-project-root>
 *   node validate-v4-readiness.cjs <path-to-v4-project-root> --strict
 *
 * --strict: treat WARNs as FAILs (for go/no-go gates)
 *
 * Requires: better-sqlite3 (npm install better-sqlite3)
 */

const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const projectRoot = args.find((a) => !a.startsWith("--"));
const STRICT = args.includes("--strict");

if (!projectRoot) {
  console.error("Usage: node validate-v4-readiness.cjs <path-to-v4-project-root> [--strict]");
  process.exit(1);
}

const root = path.resolve(projectRoot);

if (!fs.existsSync(root)) {
  console.error(`ERROR: Directory not found: ${root}`);
  process.exit(1);
}

console.log(`\nEstiClose V4 — Readiness Validator`);
console.log(`Project: ${root}`);
console.log(`Mode: ${STRICT ? "Strict (WARNs count as FAILs)" : "Standard"}\n`);

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) { console.log(`  PASS  ${msg}`); passCount++; }
function warn(msg) { console.log(`  WARN  ${msg}`); warnCount++; }
function fail(msg) { console.log(`  FAIL  ${msg}`); failCount++; }

function fileExists(rel) { return fs.existsSync(path.join(root, rel)); }

// ══════════════════════════════════════
//  Section 1: Required Files & Folders
// ══════════════════════════════════════

console.log("--- Files & Folders ---");

const requiredFiles = [
  ["package.json", "Package manifest"],
  ["server/_core/index.ts", "Server entry point"],
  ["server/_core/env.ts", "Environment config"],
  ["server/_core/stripe.ts", "Stripe client"],
  ["server/_core/stripeWebhook.ts", "Stripe webhook handler"],
  ["server/_core/adminAuth.ts", "Admin authentication"],
  ["server/db.ts", "Database layer"],
  ["server/routers.ts", "tRPC routers"],
  ["drizzle/schema.ts", "Database schema"],
  ["client/src/App.tsx", "React app entry"],
  ["client/src/pages/NewEstimate.tsx", "Estimate builder"],
  ["client/src/pages/EstimatePage.tsx", "Public estimate page"],
  ["client/src/pages/LoginPage.tsx", "Admin login page"],
  ["client/src/components/AdminGuard.tsx", "Auth guard"],
];

for (const [file, label] of requiredFiles) {
  fileExists(file) ? pass(`${label} (${file})`) : fail(`MISSING: ${label} (${file})`);
}

const requiredFolders = [
  ["client/src", "Client source"],
  ["server/_core", "Server core"],
  ["drizzle", "Schema definitions"],
];

for (const [dir, label] of requiredFolders) {
  fileExists(dir) ? pass(`${label} directory`) : fail(`MISSING: ${label} directory (${dir})`);
}

// Config system (at least one of these patterns)
const hasConfig = fileExists("config/index.ts") || fileExists("configs");
hasConfig ? pass("Company config system") : fail("MISSING: No config/ or configs/ directory");

// ══════════════════════════════════════
//  Section 2: Environment Variables
// ══════════════════════════════════════

console.log("\n--- Environment Variables ---");

const envPath = path.join(root, ".env");
let envKeys = [];

if (fs.existsSync(envPath)) {
  pass(".env file exists");
  const envContent = fs.readFileSync(envPath, "utf-8");
  envKeys = envContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim());
} else {
  fail(".env file MISSING");
}

const criticalVars = [
  ["STRIPE_SECRET_KEY", "Stripe API authentication"],
  ["STRIPE_WEBHOOK_SECRET", "Webhook signature verification"],
  ["STRIPE_USAGE_PRICE_ID", "Metered billing price"],
  ["GEMINI_API_KEY", "Image generation pipeline"],
];

const importantVars = [
  ["DATABASE_URL", "SQLite database path"],
  ["AWS_ACCESS_KEY_ID", "S3 image storage"],
  ["AWS_SECRET_ACCESS_KEY", "S3 authentication"],
  ["PUBLIC_URL", "Public-facing URL for estimate links"],
];

const optionalVars = [
  ["ADMIN_PASSWORD", "Admin setup password"],
  ["JWT_SECRET", "Session cookie signing"],
  ["AWS_REGION", "S3 region"],
  ["AWS_BUCKET_NAME", "S3 bucket"],
  ["AWS_ENDPOINT", "Custom S3 endpoint"],
  ["OAUTH_SERVER_URL", "OAuth (legacy, optional)"],
];

for (const [key, label] of criticalVars) {
  if (envKeys.includes(key)) {
    // Check it's not empty
    const envContent = fs.readFileSync(envPath, "utf-8");
    const line = envContent.split("\n").find((l) => l.trim().startsWith(key + "="));
    const val = line ? line.split("=").slice(1).join("=").trim() : "";
    if (val && val !== '""' && val !== "''") {
      pass(`${key} — ${label}`);
    } else {
      fail(`${key} is empty — ${label}`);
    }
  } else {
    fail(`${key} MISSING — ${label}`);
  }
}

for (const [key, label] of importantVars) {
  if (envKeys.includes(key)) {
    pass(`${key} — ${label}`);
  } else {
    warn(`${key} not set — ${label} (may use defaults)`);
  }
}

for (const [key, label] of optionalVars) {
  if (envKeys.includes(key)) {
    pass(`${key} — ${label}`);
  }
  // Don't warn/fail for optional vars
}

// ══════════════════════════════════════
//  Section 3: Database
// ══════════════════════════════════════

console.log("\n--- Database ---");

const dbCandidates = ["sqlite.db", "data/sqlite.db"];
let dbFile = null;

for (const candidate of dbCandidates) {
  if (fileExists(candidate)) {
    dbFile = candidate;
    break;
  }
}

if (dbFile) {
  pass(`Database file found: ${dbFile}`);

  try {
    const Database = require("better-sqlite3");
    const db = new Database(path.join(root, dbFile), { readonly: true });

    // Check V4 tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'").all().map((r) => r.name);

    const v4Tables = ["estimates", "companies", "admin_users", "usage_events"];
    for (const t of v4Tables) {
      tables.includes(t) ? pass(`Table: ${t}`) : fail(`Table MISSING: ${t}`);
    }

    // Check key V4 columns
    if (tables.includes("estimates")) {
      const cols = db.pragma("table_info(estimates)").map((c) => c.name);
      cols.includes("companyId") ? pass("estimates.companyId column") : fail("estimates.companyId MISSING");
      cols.includes("insertedAt") ? pass("estimates.insertedAt column") : fail("estimates.insertedAt MISSING");
    }

    // Check companies have Stripe mapping
    if (tables.includes("companies")) {
      const cols = db.pragma("table_info(companies)").map((c) => c.name);
      cols.includes("stripeSubscriptionId") ? pass("companies.stripeSubscriptionId column") : fail("companies.stripeSubscriptionId MISSING");

      const companyCount = db.prepare("SELECT COUNT(*) as cnt FROM companies").get().cnt;
      companyCount > 0 ? pass(`${companyCount} company record(s)`) : warn("No companies — seed one before launch");
    }

    db.close();
  } catch (e) {
    fail(`Database read error: ${e.message}`);
  }
} else {
  warn("No sqlite.db found — will be created on first start");
}

// ══════════════════════════════════════
//  Section 4: Build Readiness
// ══════════════════════════════════════

console.log("\n--- Build ---");

fileExists("node_modules") ? pass("node_modules installed") : warn("node_modules missing — run npm install");

if (fileExists("package.json")) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf-8"));
  pkg.scripts?.dev ? pass("dev script defined") : warn("No dev script");
  pkg.scripts?.build ? pass("build script defined") : fail("No build script");
  pkg.scripts?.start ? pass("start script defined") : fail("No start script");
  pkg.dependencies?.stripe ? pass(`stripe dependency (${pkg.dependencies.stripe})`) : fail("stripe not in dependencies");
}

// ══════════════════════════════════════
//  Section 5: Stripe Webhook Config
// ══════════════════════════════════════

console.log("\n--- Stripe Webhook ---");

if (fileExists("server/_core/stripeWebhook.ts")) {
  const content = fs.readFileSync(path.join(root, "server/_core/stripeWebhook.ts"), "utf-8");
  content.includes("/api/webhook/stripe") ? pass("Webhook route: POST /api/webhook/stripe") : fail("Webhook route not found in stripeWebhook.ts");
  content.includes("constructEvent") ? pass("Signature verification present") : fail("No signature verification");
  content.includes("ensureUsagePriceAttached") || content.includes("subscription") ? pass("Subscription handler present") : warn("No subscription handler logic");
}

// ══════════════════════════════════════
//  Summary
// ══════════════════════════════════════

const effectiveFails = STRICT ? failCount + warnCount : failCount;

console.log(`\n--- Summary ---`);
console.log(`  PASS: ${passCount}`);
console.log(`  WARN: ${warnCount}`);
console.log(`  FAIL: ${failCount}`);

if (STRICT && warnCount > 0) {
  console.log(`  (Strict mode: ${warnCount} WARNs counted as FAILs)`);
}

console.log(`  Status: ${effectiveFails === 0 ? "READY FOR CUTOVER" : "NOT READY — resolve issues above"}`);
console.log();

process.exit(effectiveFails > 0 ? 1 : 0);
