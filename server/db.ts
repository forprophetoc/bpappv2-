import path from "path";
import Database from "better-sqlite3";
import { and, desc, eq, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { estimates, usageEvents, InsertEstimate, InsertUser, users, companies, adminUsers, InsertCompany, InsertAdminUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _initRan = false;

/**
 * Ensure core tables exist then add V3+ columns.
 * Safe to call multiple times — CREATE IF NOT EXISTS + ALTER ignores dupes.
 */
function ensureSchema(sqlite: InstanceType<typeof Database>) {
  if (_initRan) return;
  _initRan = true;

  // ── CREATE tables if they don't exist yet ──
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS estimates (
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
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      openId       TEXT    NOT NULL UNIQUE,
      name         TEXT,
      email        TEXT,
      loginMethod  TEXT,
      role         TEXT    NOT NULL DEFAULT 'user',
      createdAt    INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt    INTEGER NOT NULL DEFAULT (unixepoch()),
      lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug      TEXT    NOT NULL UNIQUE,
      name      TEXT    NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // ── V4 migration: Stripe mapping columns on companies ──
  const companyStripeColumns = [
    "stripeCustomerId text",
    "stripeSubscriptionId text",
    "stripeSubscriptionItemId text",
  ];
  for (const col of companyStripeColumns) {
    try {
      sqlite.exec(`ALTER TABLE companies ADD COLUMN ${col}`);
    } catch (_e: unknown) {
      // Column already exists — safe to ignore
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      password  TEXT    NOT NULL,
      companyId INTEGER NOT NULL,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // ── V3 migration: add columns that may not exist yet ──
  const columns = [
    "firstName text",
    "lastName text",
    "serviceType text NOT NULL DEFAULT 'bathtub'",
    "transformationImageUrl text",
    "transformationPrice integer",
    "bathroomSinkPrice integer",
    "kitchenSinkPrice integer",
    "bookingLink text",
    "calendarEmbed text",
    "phone text",
    "address text",
    "duration text DEFAULT '3 Hours'",
    "notes text",
    "status text DEFAULT 'New Lead'",
    "viewedAt integer",
    "companyName text",
    // Epoxy fields
    "baseColor text",
    "flakeColor text",
    "maintenancePlanPrice integer",
    "uvClearCoatPrice integer",
    // Cabinet fields
    "upperCabinetColor text",
    "lowerCabinetColor text",
    "softCloseHingeUpgrade integer",
    "hardwareReplacement integer",
    "hardwareUpgrade integer",
    // Strip fee
    "stripFee integer",
    // Multi-tenant isolation
    "companyId integer",
    "companySlug text",
    // Immutable insertion timestamp for billing cycle counting (NULL default for ALTER TABLE compat)
    "insertedAt integer",
  ];
  for (const col of columns) {
    try {
      sqlite.exec(`ALTER TABLE estimates ADD COLUMN ${col}`);
    } catch (_e: unknown) {
      // Column already exists — safe to ignore
    }
  }

  // ── V5 migration: usage_events table for metered billing ──
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS usage_events (
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
  `);

  // Backfill insertedAt for existing rows that have NULL
  sqlite.exec(`UPDATE estimates SET insertedAt = createdAt WHERE insertedAt IS NULL`);
}

const DEFAULT_DB_URL = "file:./sqlite.db";

/**
 * Lazily create the drizzle instance.
 * Falls back to `file:./sqlite.db` when DATABASE_URL is not set so the
 * database is always available — even in deployments where .env is gitignored.
 */
export function getDb() {
  if (!_db) {
    try {
      const url = process.env.DATABASE_URL || DEFAULT_DB_URL;
      const rawPath = url.startsWith("file:") ? url.slice(5) : url;
      const filePath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(import.meta.dirname, "..", rawPath);
      const sqlite = new Database(filePath);
      ensureSchema(sqlite);
      _db = drizzle(sqlite);
      console.log(`[Database] SQLite ready at ${filePath}`);
    } catch (error) {
      console.error("[Database] Failed to open SQLite database:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Companies ──

export function getCompanyBySlug(slug: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = db.select().from(companies).where(eq(companies.slug, slug)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export function getCompanyById(id: number) {
  const db = getDb();
  if (!db) return undefined;
  const result = db.select().from(companies).where(eq(companies.id, id)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export function upsertCompany(data: InsertCompany) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  db.insert(companies)
    .values(data)
    .onConflictDoUpdate({ target: companies.slug, set: { name: data.name } })
    .run();
  return getCompanyBySlug(data.slug!);
}

export function updateCompanyStripeMapping(companyId: number, mapping: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId: string;
}) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  db.update(companies)
    .set(mapping)
    .where(eq(companies.id, companyId))
    .run();
  console.log(`[Database] Updated Stripe mapping for company ${companyId}: sub=${mapping.stripeSubscriptionId}, item=${mapping.stripeSubscriptionItemId}`);
}

// ── Admin Users ──

export function getAdminUserByEmail(email: string) {
  const db = getDb();
  if (!db) return undefined;
  const result = db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

export function createAdminUser(data: InsertAdminUser) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  db.insert(adminUsers).values(data).run();
  return getAdminUserByEmail(data.email);
}

// ── OAuth Users (unchanged) ──

export function upsertUser(user: InsertUser): void {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet }).run();
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export function getUserByOpenId(openId: string) {
  const db = getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = db.select().from(users).where(eq(users.openId, openId)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

// ── Slug Generation ──

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-");
}

/**
 * Build a URL-safe slug: {company-name}-{customer-name}-{MMDD}
 * Appends numeric suffix if duplicate exists.
 */
export function nameToSlug(
  name: string,
  firstName?: string,
  lastName?: string,
  companyName?: string
): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateSuffix = `${mm}${dd}`;

  let customerPart: string;
  if (firstName && lastName) {
    customerPart = normalize(`${firstName} ${lastName}`);
  } else {
    customerPart = normalize(name);
  }

  let base: string;
  if (companyName && companyName.trim()) {
    base = `${normalize(companyName)}-${customerPart}-${dateSuffix}`;
  } else {
    base = `${customerPart}-${dateSuffix}`;
  }
  const slug = base;

  const db = getDb();
  if (!db) return slug;
  const existing = db
    .select()
    .from(estimates)
    .where(eq(estimates.slug, slug))
    .limit(1)
    .all();
  if (existing.length === 0) return slug;

  for (let i = 2; i < 100; i++) {
    const candidate = `${slug}-${i}`;
    const dup = db
      .select()
      .from(estimates)
      .where(eq(estimates.slug, candidate))
      .limit(1)
      .all();
    if (dup.length === 0) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

// ── Estimates (with companyId isolation) ──

/**
 * Create or update an estimate record. Returns the saved estimate.
 */
export function upsertEstimate(data: InsertEstimate) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  db.insert(estimates)
    .values({ ...data, insertedAt: new Date() })
    .onConflictDoUpdate({
      target: estimates.slug,
      set: {
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        service: data.service,
        serviceType: data.serviceType,
        price: data.price,
        beforeUrl: data.beforeUrl,
        afterUrl: data.afterUrl,
        transformationImageUrl: data.transformationImageUrl,
        transformationPrice: data.transformationPrice,
        bathroomSinkPrice: data.bathroomSinkPrice,
        kitchenSinkPrice: data.kitchenSinkPrice,
        baseColor: data.baseColor,
        flakeColor: data.flakeColor,
        maintenancePlanPrice: data.maintenancePlanPrice,
        uvClearCoatPrice: data.uvClearCoatPrice,
        upperCabinetColor: data.upperCabinetColor,
        lowerCabinetColor: data.lowerCabinetColor,
        softCloseHingeUpgrade: data.softCloseHingeUpgrade,
        hardwareReplacement: data.hardwareReplacement,
        hardwareUpgrade: data.hardwareUpgrade,
        bookingLink: data.bookingLink,
        calendarEmbed: data.calendarEmbed,
        email: data.email,
        phone: data.phone,
        address: data.address,
        duration: data.duration,
        notes: data.notes,
        status: data.status,
        companyName: data.companyName,
        companyLogoUrl: data.companyLogoUrl,
        companyId: data.companyId,
        companySlug: data.companySlug,
      },
    })
    .run();

  const result = db.select().from(estimates).where(eq(estimates.slug, data.slug)).limit(1).all();
  return result[0];
}

/** Fetch a single estimate by its slug. Returns undefined if not found. */
export function getEstimateBySlug(slug: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  const result = db.select().from(estimates).where(eq(estimates.slug, slug)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}

/** Fetch all estimates for a specific company, newest first. */
export function getEstimatesByCompanyId(companyId: number) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(estimates).where(eq(estimates.companyId, companyId)).orderBy(desc(estimates.createdAt)).all();
}

/** Fetch all estimates, newest first (legacy — for backward compat during migration). */
export function getAllEstimates() {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(estimates).orderBy(desc(estimates.createdAt)).all();
}

/** Update the status of an estimate by id. */
export function updateEstimateStatus(id: number, status: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  db.update(estimates).set({ status }).where(eq(estimates.id, id)).run();
}

/**
 * Mark an estimate as viewed. Returns { alreadyViewed }.
 * Sets viewedAt only on first view.
 */
export function markEstimateViewed(slug: string): { alreadyViewed: boolean; estimate: ReturnType<typeof getEstimateBySlug> } {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const estimate = getEstimateBySlug(slug);
  if (!estimate) throw new Error("Estimate not found");

  if (estimate.viewedAt) {
    return { alreadyViewed: true, estimate };
  }

  const now = new Date();
  db.update(estimates)
    .set({ viewedAt: now, status: "Estimate Sent" })
    .where(eq(estimates.slug, slug))
    .run();

  return { alreadyViewed: false, estimate: { ...estimate, viewedAt: now, status: "Estimate Sent" } };
}

// ── Image Retention ──

/**
 * Clear image data from estimates older than 90 days.
 * Replaces beforeUrl/afterUrl with empty string for data: URIs,
 * or deletes S3 keys (caller handles S3 deletion).
 * Returns list of S3 URLs that need external deletion.
 */
export function clearExpiredImages(): string[] {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const expired = db.select().from(estimates)
    .where(lt(estimates.createdAt, cutoff))
    .all();

  const s3UrlsToDelete: string[] = [];

  for (const est of expired) {
    const updates: Record<string, string | null> = {};

    if (est.beforeUrl) {
      if (est.beforeUrl.startsWith("data:")) {
        updates.beforeUrl = "";
      } else if (est.beforeUrl.includes("s3.")) {
        s3UrlsToDelete.push(est.beforeUrl);
        updates.beforeUrl = "";
      }
    }

    if (est.afterUrl) {
      if (est.afterUrl.startsWith("data:")) {
        updates.afterUrl = "";
      } else if (est.afterUrl.includes("s3.")) {
        s3UrlsToDelete.push(est.afterUrl);
        updates.afterUrl = "";
      }
    }

    if (est.transformationImageUrl) {
      if (est.transformationImageUrl.startsWith("data:")) {
        updates.transformationImageUrl = "";
      } else if (est.transformationImageUrl.includes("s3.")) {
        s3UrlsToDelete.push(est.transformationImageUrl);
        updates.transformationImageUrl = "";
      }
    }

    if (Object.keys(updates).length > 0) {
      db.update(estimates).set(updates as any).where(eq(estimates.id, est.id)).run();
    }
  }

  return s3UrlsToDelete;
}

// ── Usage Metering ──

const FREE_TIER_LIMIT = 100;

/**
 * Atomically check whether a new estimate should be metered.
 * Runs inside an IMMEDIATE transaction to prevent race conditions.
 * Returns { metered: true, sequenceNum } if billable, or { metered: false } if free tier / already reported.
 */
export function meterEstimateIfNeeded(
  companyId: number,
  estimateId: number,
  estimateSlug: string,
  periodStart: number,
  periodEnd: number,
): { metered: boolean; sequenceNum: number } {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  // Use raw SQLite transaction with IMMEDIATE isolation for concurrency safety
  const sqlite = (db as any).session?.client;
  if (!sqlite) throw new Error("Cannot access raw SQLite client for transaction");

  const result = sqlite.transaction(() => {
    // Count estimates in this billing period using immutable insertedAt
    const countRow = sqlite.prepare(
      `SELECT COUNT(*) as cnt FROM estimates WHERE companyId = ? AND insertedAt >= ? AND insertedAt < ?`
    ).get(companyId, periodStart, periodEnd) as { cnt: number };

    const sequenceNum = countRow.cnt;

    // Free tier — no metering needed
    if (sequenceNum <= FREE_TIER_LIMIT) {
      return { metered: false, sequenceNum };
    }

    // Check if already reported (dedup)
    const existing = sqlite.prepare(
      `SELECT id FROM usage_events WHERE estimateSlug = ?`
    ).get(estimateSlug) as { id: number } | undefined;

    if (existing) {
      return { metered: false, sequenceNum };
    }

    // Insert usage event row (UNIQUE on estimateSlug prevents duplicates)
    sqlite.prepare(
      `INSERT INTO usage_events (companyId, estimateId, estimateSlug, sequenceNum, periodStart, periodEnd) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(companyId, estimateId, estimateSlug, sequenceNum, periodStart, periodEnd);

    return { metered: true, sequenceNum };
  }).immediate();

  return result as { metered: boolean; sequenceNum: number };
}

/**
 * Mark a usage event as successfully reported to Stripe.
 */
export function markUsageEventReported(estimateSlug: string, stripeUsageRecordId: string) {
  const db = getDb();
  if (!db) throw new Error("Database not available");
  db.update(usageEvents)
    .set({ stripeUsageRecordId, reportedAt: new Date() })
    .where(eq(usageEvents.estimateSlug, estimateSlug))
    .run();
}

/**
 * Get the Stripe mapping for a company by ID.
 */
export function getCompanyStripeMapping(companyId: number) {
  const db = getDb();
  if (!db) return undefined;
  const result = db.select({
    stripeCustomerId: companies.stripeCustomerId,
    stripeSubscriptionId: companies.stripeSubscriptionId,
    stripeSubscriptionItemId: companies.stripeSubscriptionItemId,
  }).from(companies).where(eq(companies.id, companyId)).limit(1).all();
  return result.length > 0 ? result[0] : undefined;
}
