#!/usr/bin/env node
/**
 * EstiClose Migration Toolkit — Export & Rollback
 *
 * Exports all data to JSON for portability/backup, and can rollback
 * V4-specific changes to restore a V2-compatible state.
 *
 * Usage:
 *   node export-rollback.js <path-to-sqlite.db> --export           Export all tables to JSON
 *   node export-rollback.js <path-to-sqlite.db> --rollback         Remove V4 tables/columns (destructive)
 *   node export-rollback.js <path-to-sqlite.db> --rollback --dry-run   Preview rollback without changes
 *
 * Requires: better-sqlite3 (npm install better-sqlite3)
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const args = process.argv.slice(2);
const dbPath = args.find((a) => !a.startsWith("--"));
const EXPORT = args.includes("--export");
const ROLLBACK = args.includes("--rollback");
const DRY_RUN = args.includes("--dry-run");

if (!dbPath || (!EXPORT && !ROLLBACK)) {
  console.error("Usage:");
  console.error("  node export-rollback.js <db-path> --export");
  console.error("  node export-rollback.js <db-path> --rollback [--dry-run]");
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`ERROR: Database file not found: ${dbPath}`);
  process.exit(1);
}

// ══════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════

if (EXPORT) {
  console.log(`\nEstiClose — Full Data Export`);
  console.log(`Database: ${path.resolve(dbPath)}\n`);

  const db = new Database(dbPath, { readonly: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(path.dirname(dbPath), `esticlose-export-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
    .all()
    .map((r) => r.name);

  const manifest = {
    exportedAt: new Date().toISOString(),
    sourceDb: path.resolve(dbPath),
    dbSizeBytes: fs.statSync(dbPath).size,
    tables: {},
  };

  for (const table of tables) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    const outFile = path.join(outDir, `${table}.json`);
    fs.writeFileSync(outFile, JSON.stringify(rows, null, 2));
    manifest.tables[table] = { rowCount: rows.length, file: `${table}.json` };
    console.log(`  Exported ${table}: ${rows.length} rows → ${table}.json`);
  }

  // Also copy the raw database file
  const dbCopy = path.join(outDir, "sqlite.db");
  fs.copyFileSync(dbPath, dbCopy);
  manifest.rawDbCopy = "sqlite.db";

  // Write manifest
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\n  Manifest → manifest.json`);
  console.log(`  Raw DB copy → sqlite.db`);
  console.log(`\nExport complete: ${outDir}\n`);

  db.close();
  process.exit(0);
}

// ══════════════════════════════════════
//  ROLLBACK
// ══════════════════════════════════════

if (ROLLBACK) {
  const MODE = DRY_RUN ? "[DRY-RUN]" : "[ROLLBACK]";
  console.log(`\n${MODE} EstiClose V4 → V2 Rollback`);
  console.log(`${MODE} Database: ${path.resolve(dbPath)}`);

  if (!DRY_RUN) {
    console.log(`${MODE} WARNING: This is destructive. V4 tables and data will be removed.`);
    console.log(`${MODE} A backup will be created first.\n`);
    const backupPath = dbPath + `.pre-rollback-${Date.now()}`;
    fs.copyFileSync(dbPath, backupPath);
    console.log(`${MODE} Backup: ${backupPath}\n`);
  } else {
    console.log(`${MODE} Preview mode — no changes will be made.\n`);
  }

  const db = new Database(dbPath);

  function tableExists(name) {
    return db.prepare("SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name=?").get(name).cnt > 0;
  }

  function run(sql, desc) {
    console.log(`${MODE} ${desc}`);
    if (!DRY_RUN) db.exec(sql);
  }

  let changes = 0;

  // Step 1: Drop V4-only tables
  console.log("--- V4 Tables ---");

  if (tableExists("usage_events")) {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM usage_events").get().cnt;
    if (count > 0) {
      console.log(`${MODE} WARNING: usage_events has ${count} rows that will be lost`);
    }
    run("DROP TABLE usage_events", "DROP TABLE usage_events");
    changes++;
  } else {
    console.log(`${MODE} SKIP: usage_events does not exist`);
  }

  if (tableExists("admin_users")) {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM admin_users").get().cnt;
    if (count > 0) {
      console.log(`${MODE} WARNING: admin_users has ${count} rows that will be lost`);
    }
    run("DROP TABLE admin_users", "DROP TABLE admin_users");
    changes++;
  } else {
    console.log(`${MODE} SKIP: admin_users does not exist`);
  }

  if (tableExists("companies")) {
    const count = db.prepare("SELECT COUNT(*) as cnt FROM companies").get().cnt;
    if (count > 0) {
      console.log(`${MODE} WARNING: companies has ${count} rows that will be lost`);
    }
    run("DROP TABLE companies", "DROP TABLE companies");
    changes++;
  } else {
    console.log(`${MODE} SKIP: companies does not exist`);
  }

  // Step 2: Rebuild estimates without V3/V4 columns
  // SQLite does not support DROP COLUMN on older versions,
  // so we rebuild the table with only V2 columns.
  console.log("\n--- Estimates Table Rebuild ---");

  const v2Columns = [
    "id", "slug", "name", "service", "price", "beforeUrl", "afterUrl",
    "email", "companyLogoUrl", "createdAt", "updatedAt",
  ];

  const currentCols = db.pragma("table_info(estimates)").map((c) => c.name);
  const extraCols = currentCols.filter((c) => !v2Columns.includes(c));

  if (extraCols.length > 0) {
    console.log(`${MODE} Columns to remove: ${extraCols.join(", ")}`);
    const colList = v2Columns.join(", ");
    run(`CREATE TABLE estimates_v2_temp AS SELECT ${colList} FROM estimates`, "Copy V2 columns to temp table");
    run("DROP TABLE estimates", "Drop V4 estimates table");
    run(`
      CREATE TABLE estimates (
        id         INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        slug       TEXT    NOT NULL UNIQUE,
        name       TEXT    NOT NULL,
        service    TEXT    NOT NULL,
        price      INTEGER NOT NULL,
        beforeUrl  TEXT    NOT NULL,
        afterUrl   TEXT    NOT NULL,
        email      TEXT,
        companyLogoUrl TEXT,
        createdAt  INTEGER NOT NULL DEFAULT (unixepoch()),
        updatedAt  INTEGER NOT NULL DEFAULT (unixepoch())
      );
    `, "Recreate V2 estimates table");
    run(`INSERT INTO estimates SELECT * FROM estimates_v2_temp`, "Restore estimate data");
    run("DROP TABLE estimates_v2_temp", "Drop temp table");
    changes++;
  } else {
    console.log(`${MODE} SKIP: estimates table already has only V2 columns`);
  }

  // Step 3: Vacuum
  if (!DRY_RUN) {
    console.log(`\n${MODE} VACUUM database to reclaim space`);
    db.exec("VACUUM");
  }

  console.log(`\n--- Rollback Summary ---`);
  console.log(`${MODE} Changes ${DRY_RUN ? "that would be" : ""} applied: ${changes}`);
  if (DRY_RUN) {
    console.log(`${MODE} No changes were made. Run without --dry-run to apply.`);
  }
  console.log();

  db.close();
}
