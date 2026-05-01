import path from "path";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { companies, estimates, usageEvents, InsertCompany, InsertEstimate, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _migrationRan = false;

/** Run ALTER TABLE statements for V3 fields — safe to call multiple times */
function runV3Migration(sqlite: InstanceType<typeof Database>) {
  if (_migrationRan) return;
  _migrationRan = true;

  // Create tables if they don't exist
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openId TEXT NOT NULL UNIQUE,
      name TEXT,
      email TEXT,
      loginMethod TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch()),
      lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      firstName TEXT,
      lastName TEXT,
      service TEXT NOT NULL,
      serviceType TEXT NOT NULL DEFAULT 'bathtub',
      price INTEGER NOT NULL,
      beforeUrl TEXT NOT NULL,
      afterUrl TEXT NOT NULL,
      transformationImageUrl TEXT,
      transformationPrice INTEGER,
      bathroomSinkPrice INTEGER,
      kitchenSinkPrice INTEGER,
      tileSurroundPrice INTEGER,
      otherBathroomPrice INTEGER,
      stripFee INTEGER,
      bookingLink TEXT,
      calendarEmbed TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      duration TEXT DEFAULT '3 Hours',
      notes TEXT,
      status TEXT DEFAULT 'New Lead',
      viewedAt INTEGER,
      ghlContactId TEXT,
      companyLogoUrl TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch()),
      updatedAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // ── Companies table ──
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id        INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug      TEXT    NOT NULL UNIQUE,
      name      TEXT    NOT NULL,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      stripeSubscriptionItemId TEXT,
      createdAt INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // ── Usage events table for metered billing ──
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

  const columns = [

    "firstName text",
    "lastName text",
    "serviceType text NOT NULL DEFAULT 'bathtub'",
    "transformationImageUrl text",
    "transformationPrice integer",
    "bathroomSinkPrice integer",
    "kitchenSinkPrice integer",
    "tileSurroundPrice integer",
    "otherBathroomPrice integer",
    "stripFee integer",
    "bookingLink text",
    "calendarEmbed text",
    "phone text",
    "address text",
    "duration text DEFAULT '3 Hours'",
    "notes text",
    "status text DEFAULT 'New Lead'",
    "viewedAt integer",
    "ghlContactId text",
    // Multi-tenant isolation
    "companyId integer",
    "companySlug text",
    // Immutable insertion timestamp for billing cycle counting
    "insertedAt integer",
  ];
  for (const col of columns) {
    try {
      sqlite.exec(`ALTER TABLE estimates ADD COLUMN ${col}`);
    } catch (_e: unknown) {
      // Column already exists — safe to ignore
    }
  }

  // Backfill insertedAt for existing rows that have NULL
  sqlite.exec(`UPDATE estimates SET insertedAt = createdAt WHERE insertedAt IS NULL`);
}

// Lazily create the drizzle instance so the app starts even without DATABASE_URL.
export function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Strip the "file:" prefix then resolve relative paths against the
      // project root (one level above this file) so the path is always
      // absolute and independent of process.cwd().
      const url = process.env.DATABASE_URL;
      const rawPath = url.startsWith("file:") ? url.slice(5) : url;
      const filePath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(import.meta.dirname, "..", rawPath);
      const sqlite = new Database(filePath);
      runV3Migration(sqlite);
      _db = drizzle(sqlite);
    } catch (error) {
      console.warn("[Database] Failed to open SQLite database:", error);
      _db = null;
    }
  }
  return _db;
}

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

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Build a URL-safe slug: first_name-last_name-month
 * Falls back to full name if first/last not provided.
 * Appends numeric suffix if duplicate exists.
 */
export function nameToSlug(
  name: string,
  firstName?: string,
  lastName?: string
): string {
  const month = MONTH_NAMES[new Date().getMonth()];
  let base: string;
  if (firstName && lastName) {
    base = `${firstName}-${lastName}-${month}`;
  } else {
    // Legacy fallback: derive from full name
    base = `${name}-${month}`;
  }
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s]+/g, "-")
    .replace(/-{2,}/g, "-");

  // Check for duplicates and append a short random suffix
  const db = getDb();
  if (!db) return slug;
  const existing = db
    .select()
    .from(estimates)
    .where(eq(estimates.slug, slug))
    .limit(1)
    .all();
  if (existing.length === 0) return slug;

  // Append a short alphanumeric suffix so it can't be mistaken for a date
  for (let i = 0; i < 20; i++) {
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${slug}-${suffix}`;
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

/**
 * Create or update an estimate record. Returns the saved estimate.
 */
export function upsertEstimate(data: InsertEstimate) {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  db.insert(estimates)
    .values(data)
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
        tileSurroundPrice: data.tileSurroundPrice,
        otherBathroomPrice: data.otherBathroomPrice,
        stripFee: data.stripFee,
        bookingLink: data.bookingLink,
        calendarEmbed: data.calendarEmbed,
        email: data.email,
        phone: data.phone,
        address: data.address,
        duration: data.duration,
        notes: data.notes,
        status: data.status,
        ghlContactId: data.ghlContactId,
        companyLogoUrl: data.companyLogoUrl,
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

/** Fetch all estimates, newest first. */
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
 * Mark an estimate as viewed. Returns { alreadyViewed } so caller knows
 * whether to fire the GHL alert. Sets viewedAt only on first view.
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

    // Check if already reported (dedup by estimateSlug)
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

