# EstiClose Migration Toolkit

Standalone scripts for migrating EstiClose databases from V2 to V4, verifying data integrity, and safely exporting or rolling back.

## Prerequisites

```
npm install better-sqlite3
```

No other packages needed. No connection to the live repo required.

---

## Safest Execution Order

```
# 1. Export current state as safety net
node export-rollback.cjs path/to/sqlite.db --export

# 2. Preview migration (dry-run, no changes)
node migrate-v2-to-v4.cjs path/to/sqlite.db --dry-run

# 3. Run migration
node migrate-v2-to-v4.cjs path/to/sqlite.db --apply

# 4. Verify
node integrity-check.cjs path/to/sqlite.db
```

**Always dry-run first.** Every write operation creates an automatic backup.

---

## Scripts

### 1. migrate-v2-to-v4.cjs — Schema Migration + Data Assignment

Upgrades a V2/staging SQLite database to V4 schema:
- Creates `companies`, `admin_users`, `usage_events` tables
- Adds all V3/V4 columns to `estimates` (preserves existing `ghlContactId`)
- Backfills `insertedAt` from `createdAt` for billing cycle counting
- Seeds a default company record
- Assigns orphaned estimates (NULL companyId) to the default company
- Adds Stripe mapping columns to `companies`
- Idempotent — safe to run multiple times

**Dry run (default):**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db --dry-run
```

**Apply changes:**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db --apply
```

**Custom company:**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db --apply --company-slug my-company --company-name "My Company"
```

**Skip estimate assignment (schema only):**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db --apply --skip-assign
```

### 2. integrity-check.cjs — Data Integrity Checker

Read-only scan of a V4 database. Checks:
- All required tables and columns exist
- Row counts for each table
- Referential integrity (estimates -> companies, admin_users -> companies)
- No orphaned estimates (missing companyId)
- No duplicate slugs
- insertedAt values populated and consistent
- Stripe billing mapping completeness
- Usage events integrity
- SQLite internal integrity check

```
node integrity-check.cjs path/to/sqlite.db
```

Exits with code 0 if no FAILs. Exits with code 1 if any FAIL.

### 3. export-rollback.cjs — Export & Rollback

**Export all data to JSON (portable backup):**
```
node export-rollback.cjs path/to/sqlite.db --export
```
Creates a timestamped folder with one JSON file per table, a raw DB copy, and a manifest.

**Preview rollback (dry-run):**
```
node export-rollback.cjs path/to/sqlite.db --rollback --dry-run
```

**Execute rollback to V2 (destructive):**
```
node export-rollback.cjs path/to/sqlite.db --rollback
```
Drops V4 tables, strips V3/V4 columns from estimates, vacuums. Creates backup first.

---

## Rollback Steps

If anything goes wrong after migration:

**Option A — Restore from automatic backup:**
```
cp sqlite.db.backup-v2-1777318899071 sqlite.db
```
The exact backup path is printed during migration.

**Option B — Full rollback to V2 schema:**
```
node export-rollback.cjs path/to/sqlite.db --rollback
```

**Option C — Restore from JSON export:**
If you ran `--export` before migrating, the export folder contains a raw `sqlite.db` copy.

---

## Data Repair (Submodule)

For targeted orphan detection and repair, see `data-repair/README.md`:
```
node data-repair/detect-orphaned-estimates.cjs path/to/sqlite.db
node data-repair/backfill-companyid.cjs path/to/sqlite.db --slug bathtub-pros --apply
node data-repair/verify-company-relations.cjs path/to/sqlite.db
```

---

## Warnings

- **Never run --apply on a production database without a dry-run first**
- **Never run --rollback without an export first**
- Backups are created automatically, but export gives you portable JSON
- The migration preserves `ghlContactId` — it is never dropped or renamed
- `insertedAt` is backfilled from `createdAt` — it becomes immutable after migration
- Running migration twice is safe — all operations skip if already applied

## File List

```
migration-toolkit/
  migrate-v2-to-v4.cjs         Full V2 → V4 migration
  integrity-check.cjs           Post-migration verification
  export-rollback.cjs           JSON export + V2 rollback
  README.md                     This file
  sample-run-report.md          Example successful migration output
  data-repair/
    detect-orphaned-estimates.cjs
    backfill-companyid.cjs
    verify-company-relations.cjs
    README.md
```
