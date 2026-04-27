#!/usr/bin/env node
/**
 * EstiClose Data Repair — Verify Company Relations
 *
 * Confirms that all estimate rows have valid companyId references
 * and that no orphaned or dangling references remain.
 *
 * Read-only — never modifies the database.
 *
 * Usage:
 *   node verify-company-relations.cjs <path-to-sqlite.db>
 *
 * Requires: better-sqlite3
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = process.argv[2];

if (!dbPath) {
  console.error("Usage: node verify-company-relations.cjs <path-to-sqlite.db>");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log(`\nEstiClose — Company Relations Verification`);
console.log(`Database: ${path.resolve(dbPath)}\n`);

let passCount = 0;
let failCount = 0;

function pass(msg) { console.log(`  PASS  ${msg}`); passCount++; }
function fail(msg) { console.log(`  FAIL  ${msg}`); failCount++; }

// ── Check 1: No NULL companyId ──

console.log("--- Orphaned Estimates (NULL companyId) ---");

const nullCompanyId = db.prepare(
  "SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL"
).get().cnt;

if (nullCompanyId === 0) {
  pass("No estimates with NULL companyId");
} else {
  fail(`${nullCompanyId} estimates have NULL companyId`);

  const samples = db.prepare(
    "SELECT id, slug, name, companySlug FROM estimates WHERE companyId IS NULL ORDER BY id LIMIT 5"
  ).all();

  for (const row of samples) {
    console.log(`         [${row.id}] "${row.slug}" — ${row.name} — companySlug: "${row.companySlug || "NULL"}"`);
  }
  if (nullCompanyId > 5) {
    console.log(`         ... and ${nullCompanyId - 5} more`);
  }
}

// ── Check 2: No dangling companyId references ──

console.log("\n--- Dangling companyId References ---");

const dangling = db.prepare(
  "SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NOT NULL AND companyId NOT IN (SELECT id FROM companies)"
).get().cnt;

if (dangling === 0) {
  pass("All estimate companyIds reference existing companies");
} else {
  fail(`${dangling} estimates reference non-existent company IDs`);

  const badIds = db.prepare(
    "SELECT DISTINCT companyId FROM estimates WHERE companyId NOT IN (SELECT id FROM companies)"
  ).all();

  for (const row of badIds) {
    const cnt = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId = ?").get(row.companyId).cnt;
    console.log(`         companyId=${row.companyId} — ${cnt} estimates (company does not exist)`);
  }
}

// ── Check 3: companySlug consistency ──

console.log("\n--- companySlug ↔ companyId Consistency ---");

const mismatch = db.prepare(`
  SELECT e.id, e.slug, e.companyId, e.companySlug, c.slug as actualSlug
  FROM estimates e
  JOIN companies c ON e.companyId = c.id
  WHERE e.companySlug IS NOT NULL AND e.companySlug != c.slug
  LIMIT 10
`).all();

if (mismatch.length === 0) {
  pass("All companySlug values match their companyId's actual slug");
} else {
  fail(`${mismatch.length}+ estimates have companySlug mismatch`);
  for (const row of mismatch) {
    console.log(`         [${row.id}] "${row.slug}" — companySlug="${row.companySlug}" but company ${row.companyId} has slug="${row.actualSlug}"`);
  }
}

// ── Check 4: admin_users companyId references ──

console.log("\n--- Admin User Company References ---");

const adminDangling = db.prepare(
  "SELECT COUNT(*) as cnt FROM admin_users WHERE companyId NOT IN (SELECT id FROM companies)"
).get().cnt;

if (adminDangling === 0) {
  pass("All admin_users reference existing companies");
} else {
  fail(`${adminDangling} admin users reference non-existent company IDs`);
}

// ── Check 5: usage_events companyId references ──

console.log("\n--- Usage Events Company References ---");

const usageOrphans = db.prepare(
  "SELECT COUNT(*) as cnt FROM usage_events WHERE companyId NOT IN (SELECT id FROM companies)"
).get().cnt;

if (usageOrphans === 0) {
  pass("All usage_events reference existing companies");
} else {
  fail(`${usageOrphans} usage events reference non-existent company IDs`);
}

// ── Check 6: usage_events estimate slug references ──

console.log("\n--- Usage Events Estimate References ---");

const usageSlugs = db.prepare(
  "SELECT COUNT(*) as cnt FROM usage_events WHERE estimateSlug NOT IN (SELECT slug FROM estimates)"
).get().cnt;

if (usageSlugs === 0) {
  pass("All usage_events reference existing estimate slugs");
} else {
  fail(`${usageSlugs} usage events reference non-existent estimate slugs`);
}

// ── Check 7: Per-company summary ──

console.log("\n--- Per-Company Summary ---");

const companies = db.prepare("SELECT id, slug, name FROM companies ORDER BY id").all();

for (const c of companies) {
  const estCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId = ?").get(c.id).cnt;
  const adminCount = db.prepare("SELECT COUNT(*) as cnt FROM admin_users WHERE companyId = ?").get(c.id).cnt;
  const usageCount = db.prepare("SELECT COUNT(*) as cnt FROM usage_events WHERE companyId = ?").get(c.id).cnt;
  console.log(`  Company "${c.name}" (id:${c.id}, slug:"${c.slug}")`);
  console.log(`    Estimates: ${estCount}  Admins: ${adminCount}  Usage events: ${usageCount}`);
}

// ── Summary ──

console.log(`\n--- Result ---`);
console.log(`  PASS: ${passCount}`);
console.log(`  FAIL: ${failCount}`);
console.log(`  Status: ${failCount === 0 ? "ALL RELATIONS VALID" : "ISSUES FOUND — repair needed"}`);
console.log();

db.close();
process.exit(failCount > 0 ? 1 : 0);
