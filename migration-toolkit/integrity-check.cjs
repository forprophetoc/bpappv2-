#!/usr/bin/env node
/**
 * EstiClose Migration Toolkit — Data Integrity Checker
 *
 * Validates a V4 database for structural correctness, data completeness,
 * and billing readiness. Reports PASS / WARN / FAIL for each check.
 *
 * Usage:
 *   node integrity-check.js <path-to-sqlite.db>
 *
 * Requires: better-sqlite3 (npm install better-sqlite3)
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = process.argv[2];

if (!dbPath) {
  console.error("Usage: node integrity-check.js <path-to-sqlite.db>");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

console.log(`\nEstiClose V4 — Data Integrity Check`);
console.log(`Database: ${path.resolve(dbPath)}\n`);

const db = new Database(dbPath, { readonly: true });

let passCount = 0;
let warnCount = 0;
let failCount = 0;

function pass(msg) { console.log(`  PASS  ${msg}`); passCount++; }
function warn(msg) { console.log(`  WARN  ${msg}`); warnCount++; }
function fail(msg) { console.log(`  FAIL  ${msg}`); failCount++; }

function tableExists(name) {
  return db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?").get(name).cnt > 0;
}

function columnExists(table, column) {
  return db.pragma(`table_info(${table})`).some((c) => c.name === column);
}

function rowCount(table) {
  return db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get().cnt;
}

// ── Section 1: Schema Checks ──

console.log("--- Schema ---");

const requiredTables = ["estimates", "companies", "admin_users", "users", "usage_events"];
for (const t of requiredTables) {
  tableExists(t) ? pass(`Table ${t} exists`) : fail(`Table ${t} MISSING`);
}

const estimateRequiredCols = [
  "id", "slug", "name", "service", "price", "beforeUrl", "afterUrl",
  "serviceType", "companyId", "companySlug", "insertedAt",
  "createdAt", "updatedAt", "status", "firstName", "lastName",
  "transformationPrice", "bathroomSinkPrice", "kitchenSinkPrice",
  "stripFee", "bookingLink", "calendarEmbed",
  "baseColor", "flakeColor", "maintenancePlanPrice", "uvClearCoatPrice",
  "upperCabinetColor", "lowerCabinetColor",
  "softCloseHingeUpgrade", "hardwareReplacement", "hardwareUpgrade",
];

for (const col of estimateRequiredCols) {
  columnExists("estimates", col) ? pass(`estimates.${col}`) : fail(`estimates.${col} MISSING`);
}

const companyStripeCols = ["stripeCustomerId", "stripeSubscriptionId", "stripeSubscriptionItemId"];
for (const col of companyStripeCols) {
  columnExists("companies", col) ? pass(`companies.${col}`) : fail(`companies.${col} MISSING`);
}

// ── Section 2: Data Completeness ──

console.log("\n--- Data ---");

const estCount = rowCount("estimates");
estCount > 0 ? pass(`Estimates: ${estCount} rows`) : warn(`Estimates: 0 rows (empty database)`);

const compCount = rowCount("companies");
compCount > 0 ? pass(`Companies: ${compCount} rows`) : warn(`Companies: 0 rows`);

const adminCount = rowCount("admin_users");
adminCount > 0 ? pass(`Admin users: ${adminCount} rows`) : warn(`Admin users: 0 rows — no one can log in`);

// ── Section 3: Referential Integrity ──

console.log("\n--- Referential Integrity ---");

// Estimates with NULL companyId
const orphanEst = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
if (orphanEst === 0) {
  pass("All estimates have companyId assigned");
} else {
  warn(`${orphanEst} estimates have NULL companyId — won't appear in admin dashboard`);
}

// Estimates with companyId not in companies
if (estCount > 0 && compCount > 0) {
  const danglingEst = db.prepare(
    "SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NOT NULL AND companyId NOT IN (SELECT id FROM companies)"
  ).get().cnt;
  danglingEst === 0
    ? pass("All estimate companyIds reference valid companies")
    : fail(`${danglingEst} estimates reference non-existent company IDs`);
}

// Admin users with companyId not in companies
if (adminCount > 0 && compCount > 0) {
  const danglingAdmin = db.prepare(
    "SELECT COUNT(*) as cnt FROM admin_users WHERE companyId NOT IN (SELECT id FROM companies)"
  ).get().cnt;
  danglingAdmin === 0
    ? pass("All admin_users.companyId reference valid companies")
    : fail(`${danglingAdmin} admin users reference non-existent company IDs`);
}

// Duplicate slugs (should be impossible with UNIQUE constraint, but verify)
const dupSlugs = db.prepare(
  "SELECT slug, COUNT(*) as cnt FROM estimates GROUP BY slug HAVING cnt > 1"
).all();
dupSlugs.length === 0
  ? pass("No duplicate estimate slugs")
  : fail(`${dupSlugs.length} duplicate slug(s): ${dupSlugs.map((r) => r.slug).join(", ")}`);

// ── Section 4: insertedAt Integrity ──

console.log("\n--- Immutable Timestamps ---");

const nullInsertedAt = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE insertedAt IS NULL").get().cnt;
nullInsertedAt === 0
  ? pass("All estimates have insertedAt set")
  : fail(`${nullInsertedAt} estimates have NULL insertedAt — metering will miscount`);

// Check that insertedAt <= createdAt (insertedAt should never be after createdAt for backfilled rows)
if (estCount > 0 && nullInsertedAt === 0) {
  const futureInserted = db.prepare(
    "SELECT COUNT(*) as cnt FROM estimates WHERE insertedAt > createdAt + 5"
  ).get().cnt;
  futureInserted === 0
    ? pass("All insertedAt values are consistent with createdAt")
    : warn(`${futureInserted} estimates have insertedAt significantly after createdAt`);
}

// ── Section 5: Billing Readiness ──

console.log("\n--- Billing Readiness ---");

const companiesWithStripe = db.prepare(
  "SELECT id, slug, name, stripeCustomerId, stripeSubscriptionId, stripeSubscriptionItemId FROM companies WHERE stripeSubscriptionId IS NOT NULL"
).all();

if (companiesWithStripe.length > 0) {
  for (const c of companiesWithStripe) {
    const hasAll = c.stripeCustomerId && c.stripeSubscriptionId && c.stripeSubscriptionItemId;
    if (hasAll) {
      pass(`Company "${c.name}" (id:${c.id}) — full Stripe mapping`);
    } else {
      const missing = [];
      if (!c.stripeCustomerId) missing.push("stripeCustomerId");
      if (!c.stripeSubscriptionId) missing.push("stripeSubscriptionId");
      if (!c.stripeSubscriptionItemId) missing.push("stripeSubscriptionItemId");
      warn(`Company "${c.name}" (id:${c.id}) — incomplete Stripe mapping: missing ${missing.join(", ")}`);
    }
  }
} else {
  warn("No companies have Stripe subscriptions configured — billing inactive");
}

// Usage events integrity
const usageCount = rowCount("usage_events");
if (usageCount > 0) {
  const unreported = db.prepare("SELECT COUNT(*) as cnt FROM usage_events WHERE stripeUsageRecordId IS NULL").get().cnt;
  unreported === 0
    ? pass(`All ${usageCount} usage events reported to Stripe`)
    : warn(`${unreported}/${usageCount} usage events not yet reported to Stripe`);

  // Check for usage events referencing non-existent estimates
  const danglingUsage = db.prepare(
    "SELECT COUNT(*) as cnt FROM usage_events WHERE estimateSlug NOT IN (SELECT slug FROM estimates)"
  ).get().cnt;
  danglingUsage === 0
    ? pass("All usage events reference valid estimate slugs")
    : fail(`${danglingUsage} usage events reference non-existent estimate slugs`);
} else {
  pass("No usage events yet (expected for new/test database)");
}

// ── Section 6: SQLite Health ──

console.log("\n--- Database Health ---");

const integrityResult = db.pragma("integrity_check");
integrityResult[0].integrity_check === "ok"
  ? pass("SQLite integrity check: ok")
  : fail(`SQLite integrity check failed: ${integrityResult[0].integrity_check}`);

const journalMode = db.pragma("journal_mode", { simple: true });
pass(`Journal mode: ${journalMode}`);

const dbSize = fs.statSync(dbPath).size;
pass(`Database size: ${(dbSize / 1024 / 1024).toFixed(2)} MB`);

// ── Summary ──

console.log(`\n--- Summary ---`);
console.log(`  PASS: ${passCount}`);
console.log(`  WARN: ${warnCount}`);
console.log(`  FAIL: ${failCount}`);
console.log(`  Status: ${failCount === 0 ? (warnCount === 0 ? "READY" : "READY WITH WARNINGS") : "NOT READY — fix failures before migrating"}`);
console.log();

db.close();
process.exit(failCount > 0 ? 1 : 0);
