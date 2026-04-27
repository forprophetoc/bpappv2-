#!/usr/bin/env node
/**
 * EstiClose Data Repair — Backfill companyId on Orphaned Estimates
 *
 * Assigns a companyId and companySlug to estimate rows where companyId IS NULL.
 * Dry-run by default — requires --apply flag to write changes.
 *
 * Usage:
 *   node backfill-companyid.cjs <path-to-sqlite.db> --slug <company-slug>
 *   node backfill-companyid.cjs <path-to-sqlite.db> --slug <company-slug> --apply
 *
 * Options:
 *   --slug <slug>   Company slug to assign (must exist in companies table)
 *   --apply         Actually write changes (default is dry-run)
 *   --where-slug <s>  Only backfill rows where companySlug matches this value
 *   --where-name <n>  Only backfill rows where companyName matches this value
 *
 * Requires: better-sqlite3
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const dbPath = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const APPLY = args.includes("--apply");

function getFlag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const targetSlug = getFlag("--slug");
const whereSlug = getFlag("--where-slug");
const whereName = getFlag("--where-name");

if (!dbPath || !targetSlug) {
  console.error("Usage: node backfill-companyid.cjs <path-to-sqlite.db> --slug <company-slug> [--apply]");
  console.error("Options:");
  console.error("  --where-slug <s>  Only fix rows with this companySlug value");
  console.error("  --where-name <n>  Only fix rows with this companyName value");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

const MODE = APPLY ? "[APPLY]" : "[DRY-RUN]";
console.log(`\n${MODE} EstiClose — Backfill companyId`);
console.log(`${MODE} Database: ${path.resolve(dbPath)}`);
console.log(`${MODE} Target slug: ${targetSlug}`);
if (whereSlug) console.log(`${MODE} Filter: companySlug = "${whereSlug}"`);
if (whereName) console.log(`${MODE} Filter: companyName = "${whereName}"`);
console.log(`${MODE} Mode: ${APPLY ? "LIVE — changes will be written" : "Dry run — no changes"}\n`);

const db = new Database(dbPath);

// ── Validate target company exists ──

const company = db.prepare("SELECT id, slug, name FROM companies WHERE slug = ?").get(targetSlug);

if (!company) {
  console.error(`ERROR: No company found with slug="${targetSlug}"`);
  console.error(`Available companies:`);
  const all = db.prepare("SELECT id, slug, name FROM companies ORDER BY id").all();
  for (const c of all) {
    console.error(`  id:${c.id}  slug:"${c.slug}"  name:"${c.name}"`);
  }
  db.close();
  process.exit(1);
}

console.log(`${MODE} Target company: id:${company.id} slug:"${company.slug}" name:"${company.name}"`);

// ── Build query conditions ──

let conditions = "companyId IS NULL";
const params = [];

if (whereSlug) {
  conditions += " AND companySlug = ?";
  params.push(whereSlug);
}

if (whereName) {
  conditions += " AND companyName = ?";
  params.push(whereName);
}

// ── Count affected rows ──

const affected = db.prepare(`SELECT COUNT(*) as cnt FROM estimates WHERE ${conditions}`).get(...params).cnt;

console.log(`${MODE} Rows matching criteria: ${affected}`);

if (affected === 0) {
  console.log(`${MODE} Nothing to do.\n`);
  db.close();
  process.exit(0);
}

// ── Preview affected rows ──

console.log(`\n${MODE} --- Affected Rows (first 20) ---`);

const preview = db.prepare(
  `SELECT id, slug, name, service, price, companySlug, companyName FROM estimates WHERE ${conditions} ORDER BY id LIMIT 20`
).all(...params);

for (const row of preview) {
  console.log(`${MODE}   [${row.id}] "${row.slug}" — ${row.name} — $${row.price} — current: slug="${row.companySlug || "NULL"}" name="${row.companyName || "NULL"}"`);
}

if (affected > 20) {
  console.log(`${MODE}   ... and ${affected - 20} more`);
}

// ── Apply or dry-run ──

if (!APPLY) {
  console.log(`\n${MODE} Would update ${affected} rows:`);
  console.log(`${MODE}   SET companyId = ${company.id}`);
  console.log(`${MODE}   SET companySlug = "${company.slug}"`);
  console.log(`${MODE} Run with --apply to execute.\n`);
  db.close();
  process.exit(0);
}

// ── Create backup ──

const backupPath = dbPath + `.pre-backfill-${Date.now()}`;
db.close();
fs.copyFileSync(dbPath, backupPath);
console.log(`\n${MODE} Backup created: ${backupPath}`);

const db2 = new Database(dbPath);

// ── Execute update inside transaction ──

const updateParams = [company.id, company.slug, ...params];

const result = db2.transaction(() => {
  const stmt = db2.prepare(
    `UPDATE estimates SET companyId = ?, companySlug = ? WHERE ${conditions}`
  );
  return stmt.run(...updateParams);
})();

console.log(`${MODE} Updated ${result.changes} rows`);

// ── Verify ──

const remaining = db2.prepare(`SELECT COUNT(*) as cnt FROM estimates WHERE ${conditions}`).get(...params).cnt;

console.log(`\n${MODE} --- Verification ---`);
console.log(`${MODE} Remaining orphaned rows matching criteria: ${remaining}`);

if (remaining === 0) {
  console.log(`${MODE} All matching rows assigned to company "${company.name}" (id:${company.id})`);
} else {
  console.log(`${MODE} WARNING: ${remaining} rows still unassigned — investigate manually`);
}

// Total orphans remaining
const totalOrphans = db2.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
console.log(`${MODE} Total orphaned estimates remaining: ${totalOrphans}`);

console.log(`\n${MODE} To rollback: cp "${backupPath}" "${dbPath}"\n`);

db2.close();
