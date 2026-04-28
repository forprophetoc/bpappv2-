#!/usr/bin/env node
/**
 * EstiClose Migration Toolkit — V2 to V4 Schema Migration
 *
 * Upgrades a V2 (bathtubappv2 / staging) SQLite database to V4 schema.
 * - Creates missing tables (companies, admin_users, usage_events)
 * - Adds missing columns to estimates (V3 + V4 additions)
 * - Preserves ghlContactId from V2
 * - Backfills insertedAt from createdAt
 * - Seeds default company and assigns orphaned estimates
 * - Safe to run multiple times — all operations are idempotent
 *
 * Usage:
 *   node migrate-v2-to-v4.cjs <path-to-sqlite.db> --dry-run
 *   node migrate-v2-to-v4.cjs <path-to-sqlite.db> --apply
 *   node migrate-v2-to-v4.cjs <path-to-sqlite.db> --apply --company-slug bathtub-pros --company-name "Bathtub Pros"
 *
 * Options:
 *   --dry-run              Preview changes (default if neither flag given)
 *   --apply                Write changes to database
 *   --company-slug <slug>  Slug for default company (default: bathtub-pros)
 *   --company-name <name>  Name for default company (default: Bathtub Pros)
 *   --skip-assign          Do not assign orphaned estimates to default company
 *
 * Requires: better-sqlite3 (npm install better-sqlite3)
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const DRY_RUN = !APPLY;
const SKIP_ASSIGN = args.includes("--skip-assign");

function getFlag(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const dbPath = args.find((a) => !a.startsWith("--") && !args[args.indexOf(a) - 1]?.startsWith("--"));
const companySlug = getFlag("--company-slug") || "bathtub-pros";
const companyName = getFlag("--company-name") || "Bathtub Pros";

if (!dbPath) {
  console.error("Usage: node migrate-v2-to-v4.cjs <path-to-sqlite.db> [--apply] [--dry-run]");
  console.error("  --company-slug <slug>  Default company slug (default: bathtub-pros)");
  console.error("  --company-name <name>  Default company name (default: Bathtub Pros)");
  console.error("  --skip-assign          Skip assigning orphaned estimates to default company");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

const MODE = DRY_RUN ? "[DRY-RUN]" : "[MIGRATE]";
console.log(`\n${MODE} EstiClose V2 → V4 Migration`);
console.log(`${MODE} Database: ${path.resolve(dbPath)}`);
console.log(`${MODE} Default company: "${companyName}" (slug: ${companySlug})`);
console.log(`${MODE} Mode: ${DRY_RUN ? "Dry run — no changes will be made" : "LIVE — changes will be applied"}\n`);

// ── Pre-flight: snapshot source state ──

const dbRO = new Database(dbPath, { readonly: true });
const preEstimateCount = dbRO.prepare("SELECT COUNT(*) as cnt FROM estimates").get().cnt;
const preCols = dbRO.pragma("table_info(estimates)").map((c) => c.name);
const hasGhlContactId = preCols.includes("ghlContactId");
const preTableList = dbRO.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'").all().map((r) => r.name);

console.log(`--- Pre-flight ---`);
console.log(`${MODE} Existing tables: ${preTableList.join(", ")}`);
console.log(`${MODE} Estimates: ${preEstimateCount} rows, ${preCols.length} columns`);
console.log(`${MODE} ghlContactId column: ${hasGhlContactId ? "present (will be preserved)" : "absent"}`);
dbRO.close();

// ── Backup ──

if (!DRY_RUN) {
  const backupPath = dbPath + `.backup-v2-${Date.now()}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`${MODE} Backup created: ${backupPath}`);
}

const db = DRY_RUN ? new Database(dbPath, { readonly: true }) : new Database(dbPath);
if (!DRY_RUN) {
  db.pragma("journal_mode = WAL");
}

function tableExists(name) {
  return db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?").get(name).cnt > 0;
}

function columnExists(table, column) {
  return db.pragma(`table_info(${table})`).some((c) => c.name === column);
}

function run(sql, description) {
  console.log(`${MODE} ${description}`);
  if (!DRY_RUN) {
    db.exec(sql);
  }
}

function addColumn(table, colDef, colName) {
  if (columnExists(table, colName)) {
    console.log(`${MODE} SKIP: ${table}.${colName} already exists`);
    return false;
  }
  run(`ALTER TABLE ${table} ADD COLUMN ${colDef}`, `ADD ${table}.${colName}`);
  return true;
}

let changeCount = 0;

// ══════════════════════════════════════
//  Step 1: Create missing tables
// ════════════��══════════════════════���══

console.log(`\n--- Step 1: Create Tables ---`);

if (!tableExists("companies")) {
  run(`
    CREATE TABLE companies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug      TEXT    NOT NULL UNIQUE,
      name      TEXT    NOT NULL,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      stripeSubscriptionItemId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `, "CREATE TABLE companies (with Stripe mapping columns)");
  changeCount++;
} else {
  console.log(`${MODE} SKIP: companies table already exists`);
}

if (!tableExists("admin_users")) {
  run(`
    CREATE TABLE admin_users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      password  TEXT    NOT NULL,
      companyId INTEGER NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `, "CREATE TABLE admin_users");
  changeCount++;
} else {
  console.log(`${MODE} SKIP: admin_users table already exists`);
}

if (!tableExists("usage_events")) {
  run(`
    CREATE TABLE usage_events (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      companyId           INTEGER NOT NULL,
      estimateId          INTEGER NOT NULL,
      estimateSlug        TEXT    NOT NULL UNIQUE,
      sequenceNum         INTEGER NOT NULL,
      periodStart         INTEGER NOT NULL,
      periodEnd           INTEGER NOT NULL,
      stripeUsageRecordId TEXT,
      reportedAt          INTEGER,
      createdAt           INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `, "CREATE TABLE usage_events");
  changeCount++;
} else {
  console.log(`${MODE} SKIP: usage_events table already exists`);
}

// ══════��═══════════════════════════════
//  Step 2: Estimates V3 columns
// ═════════════════���════════════════════

console.log(`\n--- Step 2: Estimates V3 Columns ---`);

// ghlContactId is a V2 column — preserve it, also add it if coming from a bare V2 that lacks it
const estimateColumns = [
  ["firstName text", "firstName"],
  ["lastName text", "lastName"],
  ["serviceType text NOT NULL DEFAULT 'bathtub'", "serviceType"],
  ["transformationImageUrl text", "transformationImageUrl"],
  ["transformationPrice integer", "transformationPrice"],
  ["bathroomSinkPrice integer", "bathroomSinkPrice"],
  ["kitchenSinkPrice integer", "kitchenSinkPrice"],
  ["bookingLink text", "bookingLink"],
  ["calendarEmbed text", "calendarEmbed"],
  ["phone text", "phone"],
  ["address text", "address"],
  ["duration text DEFAULT '3 Hours'", "duration"],
  ["notes text", "notes"],
  ["status text DEFAULT 'New Lead'", "status"],
  ["viewedAt integer", "viewedAt"],
  ["ghlContactId text", "ghlContactId"],
  ["companyName text", "companyName"],
  // V3+ additions not in V2 staging
  ["baseColor text", "baseColor"],
  ["flakeColor text", "flakeColor"],
  ["maintenancePlanPrice integer", "maintenancePlanPrice"],
  ["uvClearCoatPrice integer", "uvClearCoatPrice"],
  ["upperCabinetColor text", "upperCabinetColor"],
  ["lowerCabinetColor text", "lowerCabinetColor"],
  ["softCloseHingeUpgrade integer", "softCloseHingeUpgrade"],
  ["hardwareReplacement integer", "hardwareReplacement"],
  ["hardwareUpgrade integer", "hardwareUpgrade"],
  ["stripFee integer", "stripFee"],
  ["companyId integer", "companyId"],
  ["companySlug text", "companySlug"],
];

for (const [def, name] of estimateColumns) {
  if (addColumn("estimates", def, name)) changeCount++;
}

// ══════════════════════════════════════
//  Step 3: Estimates V4 column (insertedAt)
// ═══════════════════���══════════════════

console.log(`\n--- Step 3: Estimates V4 Column (insertedAt) ---`);

if (addColumn("estimates", "insertedAt integer", "insertedAt")) {
  changeCount++;
}

// Backfill insertedAt from createdAt
if (!DRY_RUN) {
  const nullCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE insertedAt IS NULL").get().cnt;
  if (nullCount > 0) {
    run("UPDATE estimates SET insertedAt = createdAt WHERE insertedAt IS NULL",
      `BACKFILL ${nullCount} rows: insertedAt ← createdAt`);
    changeCount++;
  } else {
    console.log(`${MODE} SKIP: All insertedAt values already populated`);
  }
} else {
  console.log(`${MODE} Would backfill insertedAt from createdAt where NULL`);
}

// ══════════════════════════════════════
//  Step 4: Companies Stripe mapping columns
// ══════════════════════════════════════

console.log(`\n--- Step 4: Companies Stripe Mapping ---`);

if (tableExists("companies")) {
  const stripeColumns = [
    ["stripeCustomerId text", "stripeCustomerId"],
    ["stripeSubscriptionId text", "stripeSubscriptionId"],
    ["stripeSubscriptionItemId text", "stripeSubscriptionItemId"],
  ];
  for (const [def, name] of stripeColumns) {
    if (addColumn("companies", def, name)) changeCount++;
  }
}

// ════════════���═══════════════════════���═
//  Step 5: Seed default company
// ═════════════════════════════���════════

console.log(`\n--- Step 5: Seed Default Company ---`);

if (!DRY_RUN) {
  const existing = db.prepare("SELECT id FROM companies WHERE slug = ?").get(companySlug);
  if (existing) {
    console.log(`${MODE} SKIP: Company "${companySlug}" already exists (id:${existing.id})`);
  } else {
    db.prepare("INSERT INTO companies (slug, name) VALUES (?, ?)").run(companySlug, companyName);
    const created = db.prepare("SELECT id FROM companies WHERE slug = ?").get(companySlug);
    console.log(`${MODE} CREATED company "${companyName}" (id:${created.id}, slug:${companySlug})`);
    changeCount++;
  }
} else {
  console.log(`${MODE} Would create company "${companyName}" (slug: ${companySlug}) if not exists`);
}

// ═════════════════════��════════════════
//  Step 6: Assign orphaned estimates
// ══════════════════════════════════════

console.log(`\n--- Step 6: Assign Orphaned Estimates ---`);

if (SKIP_ASSIGN) {
  console.log(`${MODE} SKIP: --skip-assign flag set`);
} else if (!DRY_RUN) {
  const company = db.prepare("SELECT id, slug FROM companies WHERE slug = ?").get(companySlug);
  if (!company) {
    console.log(`${MODE} ERROR: Cannot assign — company "${companySlug}" not found`);
  } else {
    const orphanCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
    if (orphanCount === 0) {
      console.log(`${MODE} SKIP: No orphaned estimates (all have companyId)`);
    } else {
      db.prepare("UPDATE estimates SET companyId = ?, companySlug = ? WHERE companyId IS NULL")
        .run(company.id, company.slug);
      console.log(`${MODE} ASSIGNED ${orphanCount} orphaned estimates → company "${companySlug}" (id:${company.id})`);
      changeCount++;
    }
  }
} else {
  if (columnExists("estimates", "companyId")) {
    const orphanCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
    console.log(`${MODE} Would assign ${orphanCount} orphaned estimates → "${companySlug}"`);
  } else {
    console.log(`${MODE} Would assign all ${preEstimateCount} estimates → "${companySlug}" (companyId column will be added)`);
  }
}

// ══════════════════════════════════════
//  Step 7: Indexes
// ══════════════════════════════���═══════

console.log(`\n--- Step 7: Indexes ---`);

if (!DRY_RUN) {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name);

  if (!indexes.includes("estimates_slug_unique")) {
    run("CREATE UNIQUE INDEX IF NOT EXISTS estimates_slug_unique ON estimates(slug)",
      "CREATE INDEX estimates_slug_unique");
    changeCount++;
  } else {
    console.log(`${MODE} SKIP: estimates_slug_unique already exists`);
  }
} else {
  console.log(`${MODE} Would ensure estimates_slug_unique index exists`);
}

// ═══════════���══════════════════════════
//  Post-flight verification
// ═════════════════���════════════════��═══

console.log(`\n--- Post-flight ---`);

const postEstimateCount = db.prepare("SELECT COUNT(*) as cnt FROM estimates").get().cnt;
const postCols = db.pragma("table_info(estimates)").map((c) => c.name);
const postTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'").all().map((r) => r.name);

console.log(`${MODE} Tables: ${postTables.join(", ")}`);
console.log(`${MODE} Estimates: ${postEstimateCount} rows, ${postCols.length} columns`);
console.log(`${MODE} ghlContactId preserved: ${postCols.includes("ghlContactId") ? "YES" : "NO"}`);
console.log(`${MODE} insertedAt present: ${postCols.includes("insertedAt") ? "YES" : "NO"}`);
console.log(`${MODE} companyId present: ${postCols.includes("companyId") ? "YES" : "NO"}`);

if (postEstimateCount !== preEstimateCount) {
  console.log(`${MODE} WARNING: Row count changed ${preEstimateCount} → ${postEstimateCount}`);
}

if (!DRY_RUN && columnExists("estimates", "companyId")) {
  const orphansRemaining = db.prepare("SELECT COUNT(*) as cnt FROM estimates WHERE companyId IS NULL").get().cnt;
  console.log(`${MODE} Orphaned estimates remaining: ${orphansRemaining}`);
}

// ══════════════════════════════════════
//  Summary
// ══════════════════════════════════��═══

console.log(`\n--- Migration Summary ---`);
console.log(`${MODE} Changes ${DRY_RUN ? "that would be" : ""} applied: ${changeCount}`);

if (DRY_RUN) {
  console.log(`${MODE} No changes were made. Run with --apply to execute.`);
}

console.log(`${MODE} Done.\n`);
db.close();
