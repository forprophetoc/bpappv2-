#!/usr/bin/env node
/**
 * EstiClose Migration Toolkit — V2 to V4 Schema Migration
 *
 * Upgrades a V2 (bathtubappv2) SQLite database to V4 schema.
 * Safe to run multiple times — all operations are idempotent.
 *
 * Usage:
 *   node migrate-v2-to-v4.js <path-to-sqlite.db> [--dry-run]
 *
 * Requires: better-sqlite3 (npm install better-sqlite3)
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const dbPath = args.find((a) => !a.startsWith("--"));

if (!dbPath) {
  console.error("Usage: node migrate-v2-to-v4.js <path-to-sqlite.db> [--dry-run]");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

const MODE = DRY_RUN ? "[DRY-RUN]" : "[MIGRATE]";
console.log(`\n${MODE} EstiClose V2 → V4 Migration`);
console.log(`${MODE} Database: ${path.resolve(dbPath)}`);
console.log(`${MODE} Mode: ${DRY_RUN ? "Dry run — no changes will be made" : "LIVE — changes will be applied"}\n`);

// ── Backup ──
if (!DRY_RUN) {
  const backupPath = dbPath + `.backup-v2-${Date.now()}`;
  fs.copyFileSync(dbPath, backupPath);
  console.log(`${MODE} Backup created: ${backupPath}`);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableExists(name) {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return row.cnt > 0;
}

function columnExists(table, column) {
  const cols = db.pragma(`table_info(${table})`);
  return cols.some((c) => c.name === column);
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

// ── Step 1: Create missing tables ──

console.log(`\n--- Step 1: Tables ---`);

if (!tableExists("companies")) {
  run(`
    CREATE TABLE companies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug      TEXT    NOT NULL UNIQUE,
      name      TEXT    NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `, "CREATE TABLE companies");
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

// ── Step 2: estimates columns (V3 additions) ──

console.log(`\n--- Step 2: Estimates V3 Columns ---`);

const estimateV3Columns = [
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
  ["companyName text", "companyName"],
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

for (const [def, name] of estimateV3Columns) {
  if (addColumn("estimates", def, name)) changeCount++;
}

// ── Step 3: estimates V4 column (insertedAt) ──

console.log(`\n--- Step 3: Estimates V4 Column ---`);

if (addColumn("estimates", "insertedAt integer", "insertedAt")) {
  changeCount++;
  // Backfill insertedAt from createdAt for existing rows
  run(
    "UPDATE estimates SET insertedAt = createdAt WHERE insertedAt IS NULL",
    "BACKFILL estimates.insertedAt from createdAt"
  );
}

// ── Step 4: companies Stripe mapping columns ──

console.log(`\n--- Step 4: Companies Stripe Mapping ---`);

const companyStripeColumns = [
  ["stripeCustomerId text", "stripeCustomerId"],
  ["stripeSubscriptionId text", "stripeSubscriptionId"],
  ["stripeSubscriptionItemId text", "stripeSubscriptionItemId"],
];

for (const [def, name] of companyStripeColumns) {
  if (addColumn("companies", def, name)) changeCount++;
}

// ── Step 5: Ensure indexes ──

console.log(`\n--- Step 5: Indexes ---`);

const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name);

if (!indexes.includes("estimates_slug_unique")) {
  run(
    "CREATE UNIQUE INDEX IF NOT EXISTS estimates_slug_unique ON estimates(slug)",
    "CREATE INDEX estimates_slug_unique"
  );
  changeCount++;
} else {
  console.log(`${MODE} SKIP: estimates_slug_unique index already exists`);
}

// ── Summary ──

console.log(`\n--- Migration Summary ---`);
console.log(`${MODE} Changes ${DRY_RUN ? "that would be" : ""} applied: ${changeCount}`);

if (DRY_RUN) {
  console.log(`${MODE} No changes were made. Run without --dry-run to apply.`);
}

console.log(`${MODE} Done.\n`);
db.close();
