# Sample Migration Run — V2 Staging → V4

Source: `esticlose-v4-trunk/sqlite.db` (6 estimates, 2 tables, ghlContactId present)

## Step 1: Dry Run

```
$ node migrate-v2-to-v4.cjs sqlite.db --dry-run

[DRY-RUN] EstiClose V2 → V4 Migration
[DRY-RUN] Database: C:\Users\test\Desktop\esticlose-v4-trunk\sqlite.db
[DRY-RUN] Default company: "Bathtub Pros" (slug: bathtub-pros)
[DRY-RUN] Mode: Dry run — no changes will be made

--- Pre-flight ---
[DRY-RUN] Existing tables: estimates, users
[DRY-RUN] Estimates: 6 rows, 28 columns
[DRY-RUN] ghlContactId column: present (will be preserved)

--- Step 1: Create Tables ---
[DRY-RUN] CREATE TABLE companies (with Stripe mapping columns)
[DRY-RUN] CREATE TABLE admin_users
[DRY-RUN] CREATE TABLE usage_events

--- Step 2: Estimates V3 Columns ---
[DRY-RUN] SKIP: estimates.firstName already exists
[DRY-RUN] SKIP: estimates.lastName already exists
[DRY-RUN] SKIP: estimates.serviceType already exists
[DRY-RUN] (13 more existing columns skipped)
[DRY-RUN] ADD estimates.baseColor
[DRY-RUN] ADD estimates.flakeColor
[DRY-RUN] ADD estimates.maintenancePlanPrice
[DRY-RUN] ADD estimates.uvClearCoatPrice
[DRY-RUN] ADD estimates.upperCabinetColor
[DRY-RUN] ADD estimates.lowerCabinetColor
[DRY-RUN] ADD estimates.softCloseHingeUpgrade
[DRY-RUN] ADD estimates.hardwareReplacement
[DRY-RUN] ADD estimates.hardwareUpgrade
[DRY-RUN] ADD estimates.stripFee
[DRY-RUN] ADD estimates.companyId
[DRY-RUN] ADD estimates.companySlug

--- Step 3: Estimates V4 Column (insertedAt) ---
[DRY-RUN] ADD estimates.insertedAt
[DRY-RUN] Would backfill insertedAt from createdAt where NULL

--- Step 5: Seed Default Company ---
[DRY-RUN] Would create company "Bathtub Pros" (slug: bathtub-pros) if not exists

--- Step 6: Assign Orphaned Estimates ---
[DRY-RUN] Would assign all 6 estimates → "bathtub-pros" (companyId column will be added)

--- Migration Summary ---
[DRY-RUN] Changes that would be applied: 16
[DRY-RUN] No changes were made. Run with --apply to execute.
```

## Step 2: Apply

```
$ node migrate-v2-to-v4.cjs sqlite.db --apply

[MIGRATE] EstiClose V2 → V4 Migration
[MIGRATE] Database: C:\Users\test\Desktop\esticlose-v4-trunk\sqlite.db
[MIGRATE] Default company: "Bathtub Pros" (slug: bathtub-pros)
[MIGRATE] Mode: LIVE — changes will be applied

--- Pre-flight ---
[MIGRATE] Existing tables: estimates, users
[MIGRATE] Estimates: 6 rows, 28 columns
[MIGRATE] ghlContactId column: present (will be preserved)
[MIGRATE] Backup created: sqlite.db.backup-v2-1777318899071

--- Step 1: Create Tables ---
[MIGRATE] CREATE TABLE companies (with Stripe mapping columns)
[MIGRATE] CREATE TABLE admin_users
[MIGRATE] CREATE TABLE usage_events

--- Step 2: Estimates V3 Columns ---
[MIGRATE] ADD estimates.baseColor
[MIGRATE] ADD estimates.flakeColor
[MIGRATE] ADD estimates.maintenancePlanPrice
[MIGRATE] ADD estimates.uvClearCoatPrice
[MIGRATE] ADD estimates.upperCabinetColor
[MIGRATE] ADD estimates.lowerCabinetColor
[MIGRATE] ADD estimates.softCloseHingeUpgrade
[MIGRATE] ADD estimates.hardwareReplacement
[MIGRATE] ADD estimates.hardwareUpgrade
[MIGRATE] ADD estimates.stripFee
[MIGRATE] ADD estimates.companyId
[MIGRATE] ADD estimates.companySlug

--- Step 3: Estimates V4 Column (insertedAt) ---
[MIGRATE] ADD estimates.insertedAt
[MIGRATE] BACKFILL 6 rows: insertedAt ← createdAt

--- Step 5: Seed Default Company ---
[MIGRATE] CREATED company "Bathtub Pros" (id:1, slug:bathtub-pros)

--- Step 6: Assign Orphaned Estimates ---
[MIGRATE] ASSIGNED 6 orphaned estimates → company "bathtub-pros" (id:1)

--- Step 7: Indexes ---
[MIGRATE] CREATE INDEX estimates_slug_unique

--- Post-flight ---
[MIGRATE] Tables: estimates, users, companies, admin_users, usage_events
[MIGRATE] Estimates: 6 rows, 41 columns
[MIGRATE] ghlContactId preserved: YES
[MIGRATE] insertedAt present: YES
[MIGRATE] companyId present: YES
[MIGRATE] Orphaned estimates remaining: 0

--- Migration Summary ---
[MIGRATE] Changes applied: 20
[MIGRATE] Done.
```

## Step 3: Integrity Check

```
$ node integrity-check.cjs sqlite.db

EstiClose V4 — Data Integrity Check
Database: C:\Users\test\Desktop\esticlose-v4-trunk\sqlite.db

--- Schema ---
  PASS  Table estimates exists
  PASS  Table companies exists
  PASS  Table admin_users exists
  PASS  Table users exists
  PASS  Table usage_events exists
  PASS  estimates.id
  PASS  estimates.slug
  (30 more column checks — all PASS)
  PASS  companies.stripeCustomerId
  PASS  companies.stripeSubscriptionId
  PASS  companies.stripeSubscriptionItemId

--- Data ---
  PASS  Estimates: 6 rows
  PASS  Companies: 1 rows
  WARN  Admin users: 0 rows — no one can log in

--- Referential Integrity ---
  PASS  All estimates have companyId assigned
  PASS  All estimate companyIds reference valid companies
  PASS  No duplicate estimate slugs

--- Immutable Timestamps ---
  PASS  All estimates have insertedAt set
  PASS  All insertedAt values are consistent with createdAt

--- Billing Readiness ---
  WARN  No companies have Stripe subscriptions configured — billing inactive
  PASS  No usage events yet (expected for new/test database)

--- Database Health ---
  PASS  SQLite integrity check: ok
  PASS  Journal mode: wal
  PASS  Database size: 0.05 MB

--- Summary ---
  PASS: 50
  WARN: 2
  FAIL: 0
  Status: READY WITH WARNINGS
```

## Result

| Metric | Before | After |
|--------|--------|-------|
| Tables | 2 (estimates, users) | 5 (+companies, admin_users, usage_events) |
| Estimate columns | 28 | 41 |
| ghlContactId | present | preserved |
| insertedAt | absent | backfilled from createdAt |
| Orphaned estimates | 6 | 0 |
| Company records | 0 | 1 (Bathtub Pros) |
| Data loss | — | none |
| Integrity FAILs | — | 0 |

Warnings are expected:
- No admin users (created separately via onboarding)
- No Stripe config (populated by webhook on first subscription)
