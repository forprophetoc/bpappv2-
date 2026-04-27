# EstiClose Migration Toolkit

Standalone scripts for migrating EstiClose databases from V2 to V4, verifying data integrity, and safely exporting or rolling back.

## Prerequisites

One dependency required:

```
npm install better-sqlite3
```

No other packages needed. No connection to the live repo required.

---

## What Each Script Does

### 1. migrate-v2-to-v4.js — Schema Migration

Upgrades a V2 (bathtubappv2-era) SQLite database to the V4 schema. Adds all missing tables, columns, indexes, and backfills the immutable `insertedAt` timestamp.

Safe to run multiple times. Skips anything that already exists.

**Dry run first (recommended):**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db --dry-run
```
Shows every change that would be made without touching the database.

**Run for real:**
```
node migrate-v2-to-v4.cjs path/to/sqlite.db
```
Creates an automatic backup before making any changes.

### 2. integrity-check.js — Data Integrity Checker

Read-only scan of a V4 database. Checks:

- All required tables and columns exist
- Row counts for each table
- Referential integrity (estimates → companies, admin_users → companies)
- No orphaned estimates (missing companyId)
- No duplicate slugs
- insertedAt values are populated and consistent
- Stripe billing mapping completeness
- Usage events integrity
- SQLite internal integrity check

**Run:**
```
node integrity-check.cjs path/to/sqlite.db
```

Exits with code 0 if all checks pass (warnings are OK). Exits with code 1 if any FAIL.

### 3. export-rollback.js — Export & Rollback

Two modes:

**Export all data to JSON:**
```
node export-rollback.cjs path/to/sqlite.db --export
```
Creates a timestamped folder with:
- One JSON file per table (human-readable, portable)
- A raw copy of the SQLite database
- A manifest.json with row counts and metadata

Use this before any destructive operation, or to move data between environments.

**Rollback V4 to V2 (destructive):**
```
node export-rollback.cjs path/to/sqlite.db --rollback --dry-run
```
Preview what would be removed.

```
node export-rollback.cjs path/to/sqlite.db --rollback
```
Drops V4-only tables (usage_events, admin_users, companies), strips V3/V4 columns from estimates, and vacuums the database. Creates a backup first.

---

## Typical Workflow

### Migrating a V2 database to V4

```
# 1. Export current state as safety net
node export-rollback.cjs old-app/sqlite.db --export

# 2. Preview migration
node migrate-v2-to-v4.cjs old-app/sqlite.db --dry-run

# 3. Run migration
node migrate-v2-to-v4.cjs old-app/sqlite.db

# 4. Verify
node integrity-check.cjs old-app/sqlite.db
```

### Migrating Bathtub Pros specifically

After running the V4 migration:

```
# Assign orphaned estimates to company 1
sqlite3 sqlite.db "UPDATE estimates SET companyId=1, companySlug='bathtub-pros' WHERE companyId IS NULL;"

# Re-verify
node integrity-check.cjs sqlite.db
```

### Rolling back if something goes wrong

```
# Preview rollback
node export-rollback.cjs sqlite.db --rollback --dry-run

# Execute rollback (creates backup automatically)
node export-rollback.cjs sqlite.db --rollback
```

Or simply restore from the automatic backup created during migration:
```
cp sqlite.db.backup-v2-1777312345 sqlite.db
```

---

## What V4 Adds Over V2

| Addition | Purpose |
|----------|---------|
| `companies` table | Multi-tenant company isolation |
| `admin_users` table | Email/password authentication |
| `usage_events` table | Stripe metered billing deduplication |
| `estimates.companyId` | Links estimates to company |
| `estimates.insertedAt` | Immutable timestamp for billing cycle counting |
| `estimates.serviceType` | Tub / shower / epoxy / cabinet differentiation |
| `estimates.stripFee` | Chemical strip fee tracking |
| `estimates.*Price` columns | Per-upsell price tracking |
| `companies.stripe*` columns | Stripe subscription mapping for automated billing |

---

## File Sizes

Each script is under 200 lines. No build step. Copy them anywhere and run with Node.js + better-sqlite3.
