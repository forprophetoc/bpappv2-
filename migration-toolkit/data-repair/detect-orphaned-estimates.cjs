#!/usr/bin/env node
/**
 * EstiClose Data Repair — Detect Orphaned Estimates
 *
 * Scans for estimate rows with NULL companyId and reports
 * counts, likely tenant groupings, and affected slugs.
 *
 * Read-only — never modifies the database.
 *
 * Usage:
 *   node detect-orphaned-estimates.cjs <path-to-sqlite.db>
 *   node detect-orphaned-estimates.cjs <path-to-sqlite.db> --verbose
 *
 * Requires: better-sqlite3
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const dbPath = args.find((a) => !a.startsWith("--"));
const VERBOSE = args.includes("--verbose");

if (!dbPath) {
  console.error("Usage: node detect-orphaned-estimates.cjs <path-to-sqlite.db> [--verbose]");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

console.log(`\nEstiClose — Orphaned Estimate Detection`);
console.log(`Database: ${path.resolve(dbPath)}\n`);

// ── Total counts ──

const total = db.prepare("SELECT COUNT(*) as cnt FROM estimates").get().cnt;
const orphaned = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
const assigned = total - orphaned;

console.log(`--- Counts ---`);
console.log(`  Total estimates:    ${total}`);
console.log(`  Assigned (has companyId): ${assigned}`);
console.log(`  Orphaned (NULL companyId): ${orphaned}`);

if (orphaned === 0) {
  console.log(`\n  No orphaned estimates found. Nothing to repair.\n`);
  db.close();
  process.exit(0);
}

// ── Group by companySlug (may give tenant hints) ──

console.log(`\n--- Orphaned by companySlug ---`);

const bySlug = db.prepare(
  "SELECT companySlug, COUNT(*) as cnt FROM estimates WHERE companyId IS NULL GROUP BY companySlug ORDER BY cnt DESC"
).all();

if (bySlug.length === 0) {
  console.log(`  (no companySlug values set)`);
} else {
  for (const row of bySlug) {
    console.log(`  ${row.companySlug || "(NULL)"}: ${row.cnt} rows`);
  }
}

// ── Group by companyName ──

console.log(`\n--- Orphaned by companyName ---`);

const byName = db.prepare(
  "SELECT companyName, COUNT(*) as cnt FROM estimates WHERE companyId IS NULL GROUP BY companyName ORDER BY cnt DESC"
).all();

if (byName.length === 0) {
  console.log(`  (no companyName values set)`);
} else {
  for (const row of byName) {
    console.log(`  ${row.companyName || "(NULL)"}: ${row.cnt} rows`);
  }
}

// ── Group by companyLogoUrl (another tenant signal) ──

console.log(`\n--- Orphaned by companyLogoUrl ---`);

const byLogo = db.prepare(
  "SELECT companyLogoUrl, COUNT(*) as cnt FROM estimates WHERE companyId IS NULL GROUP BY companyLogoUrl ORDER BY cnt DESC"
).all();

for (const row of byLogo) {
  const label = row.companyLogoUrl
    ? (row.companyLogoUrl.length > 60 ? row.companyLogoUrl.substring(0, 60) + "..." : row.companyLogoUrl)
    : "(NULL)";
  console.log(`  ${label}: ${row.cnt} rows`);
}

// ── Date range of orphaned rows ──

console.log(`\n--- Orphaned Date Range ---`);

const dateRange = db.prepare(
  "SELECT MIN(createdAt) as earliest, MAX(createdAt) as latest FROM estimates WHERE companyId IS NULL"
).get();

if (dateRange.earliest) {
  console.log(`  Earliest: ${new Date(dateRange.earliest * 1000).toISOString()}`);
  console.log(`  Latest:   ${new Date(dateRange.latest * 1000).toISOString()}`);
} else {
  console.log(`  (no timestamp data)`);
}

// ── Service type breakdown ──

console.log(`\n--- Orphaned by serviceType ---`);

const byService = db.prepare(
  "SELECT serviceType, COUNT(*) as cnt FROM estimates WHERE companyId IS NULL GROUP BY serviceType ORDER BY cnt DESC"
).all();

for (const row of byService) {
  console.log(`  ${row.serviceType}: ${row.cnt} rows`);
}

// ── Available companies for assignment ──

console.log(`\n--- Available Companies ---`);

const companies = db.prepare("SELECT id, slug, name FROM companies ORDER BY id").all();

if (companies.length === 0) {
  console.log(`  (none — companies table is empty)`);
} else {
  for (const c of companies) {
    const estCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId = ?").get(c.id).cnt;
    console.log(`  id:${c.id}  slug:"${c.slug}"  name:"${c.name}"  estimates:${estCount}`);
  }
}

// ── Verbose: list every orphaned row ──

if (VERBOSE) {
  console.log(`\n--- All Orphaned Rows ---`);

  const rows = db.prepare(
    "SELECT id, slug, name, service, serviceType, price, companySlug, companyName, createdAt FROM estimates WHERE companyId IS NULL ORDER BY createdAt DESC"
  ).all();

  for (const row of rows) {
    const date = row.createdAt ? new Date(row.createdAt * 1000).toISOString().split("T")[0] : "?";
    console.log(`  [${row.id}] ${date}  "${row.slug}"  ${row.serviceType}  $${row.price}  company:"${row.companySlug || row.companyName || "?"}"  customer:"${row.name}"`);
  }
}

// ── Recommendation ──

console.log(`\n--- Recommendation ---`);

if (bySlug.length === 1 && bySlug[0].companySlug) {
  console.log(`  All ${orphaned} orphaned rows share companySlug="${bySlug[0].companySlug}".`);
  const match = companies.find((c) => c.slug === bySlug[0].companySlug);
  if (match) {
    console.log(`  This matches company id:${match.id} ("${match.name}").`);
    console.log(`  Suggested fix: node backfill-companyid.cjs ${dbPath} --slug ${match.slug}`);
  } else {
    console.log(`  WARNING: No company with slug="${bySlug[0].companySlug}" exists in the companies table.`);
    console.log(`  Create the company first, then run backfill.`);
  }
} else if (byName.length === 1 && byName[0].companyName) {
  console.log(`  All ${orphaned} orphaned rows share companyName="${byName[0].companyName}".`);
  console.log(`  Likely a single tenant. Use backfill-companyid.cjs to assign.`);
} else if (bySlug.length === 0 && byName.length <= 1) {
  console.log(`  Orphaned rows have no companySlug or companyName — likely pre-multi-tenant data.`);
  if (companies.length === 1) {
    console.log(`  Only one company exists (id:${companies[0].id}, "${companies[0].name}").`);
    console.log(`  Suggested fix: node backfill-companyid.cjs ${dbPath} --slug ${companies[0].slug}`);
  } else {
    console.log(`  Multiple companies exist. Manual review needed to determine assignment.`);
  }
} else {
  console.log(`  Orphaned rows span multiple tenants. Review --verbose output to determine grouping.`);
}

console.log();
db.close();
