# EstiClose Data Repair Toolkit

Standalone scripts for detecting and fixing orphaned estimate rows where `companyId` is NULL after V4 migration.

## Prerequisites

```
npm install better-sqlite3
```

No other dependencies. No connection to live systems.

## Important: Always Dry-Run First

Every write operation defaults to dry-run mode. You must explicitly pass `--apply` to make changes. Backups are created automatically before any write.

---

## Scripts

### 1. detect-orphaned-estimates.cjs

Scans for estimates with NULL companyId. Groups them by companySlug, companyName, companyLogoUrl, serviceType, and date range to help identify which tenant they belong to. Suggests a fix command.

```
node detect-orphaned-estimates.cjs path/to/sqlite.db
```

Verbose mode (lists every orphaned row):
```
node detect-orphaned-estimates.cjs path/to/sqlite.db --verbose
```

Read-only. Never modifies the database.

### 2. backfill-companyid.cjs

Assigns a companyId and companySlug to orphaned rows. Dry-run by default.

**Preview what would change:**
```
node backfill-companyid.cjs path/to/sqlite.db --slug bathtub-pros
```

**Apply changes:**
```
node backfill-companyid.cjs path/to/sqlite.db --slug bathtub-pros --apply
```

**Filter by existing companySlug value (for multi-tenant databases):**
```
node backfill-companyid.cjs path/to/sqlite.db --slug bathtub-pros --where-slug bathtub-pros
```

**Filter by companyName:**
```
node backfill-companyid.cjs path/to/sqlite.db --slug bathtub-pros --where-name "Bathtub Pros"
```

Creates a backup automatically before writing (e.g., `sqlite.db.pre-backfill-1777312345`).

### 3. verify-company-relations.cjs

Post-repair verification. Checks:

- No NULL companyId rows remain
- No companyId references to non-existent companies
- companySlug values match their company's actual slug
- admin_users and usage_events references are valid
- Per-company row counts

```
node verify-company-relations.cjs path/to/sqlite.db
```

Read-only. Exits with code 0 if all checks pass, code 1 if any fail.

---

## Typical Workflow

```
# Step 1: Detect the problem
node detect-orphaned-estimates.cjs sqlite.db

# Step 2: Preview the fix (dry-run, no changes)
node backfill-companyid.cjs sqlite.db --slug bathtub-pros

# Step 3: Apply the fix
node backfill-companyid.cjs sqlite.db --slug bathtub-pros --apply

# Step 4: Verify
node verify-company-relations.cjs sqlite.db
```

## Rollback

Every `--apply` operation creates a timestamped backup before writing. To rollback:

```
cp sqlite.db.pre-backfill-1777312345 sqlite.db
```

The exact backup path is printed in the script output.

## Multi-Tenant Databases

If orphaned rows belong to different companies, run backfill separately for each group using filters:

```
# First tenant
node backfill-companyid.cjs sqlite.db --slug company-a --where-name "Company A" --apply

# Second tenant
node backfill-companyid.cjs sqlite.db --slug company-b --where-name "Company B" --apply

# Verify all assigned
node verify-company-relations.cjs sqlite.db
```

## File List

```
data-repair/
  detect-orphaned-estimates.cjs   Read-only detection
  backfill-companyid.cjs          Dry-run + apply backfill
  verify-company-relations.cjs    Post-repair verification
  README.md                       This file
```
