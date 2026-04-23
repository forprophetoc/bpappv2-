import path from "path";
import Database from "better-sqlite3";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { estimates, InsertEstimate, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _initRan = false;

/**
 * Ensure core tables exist then add V3 columns.
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
    "ghlContactId text",
    "companyName text",
  ];
  for (const col of columns) {
    try {
      sqlite.exec(`ALTER TABLE estimates ADD COLUMN ${col}`);
    } catch (_e: unknown) {
      // Column already exists — safe to ignore
    }
  }
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
      // Strip the "file:" prefix then resolve relative paths against the
      // project root (one level above this file) so the path is always
      // absolute and independent of process.cwd().
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
 * Falls back to {customer-name}-{MMDD} if company not provided.
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

  // Check for duplicates and append suffix
  const db = getDb();
  if (!db) return slug;
  const existing = db
    .select()
    .from(estimates)
    .where(eq(estimates.slug, slug))
    .limit(1)
    .all();
  if (existing.length === 0) return slug;

  // Find next available suffix
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
        bookingLink: data.bookingLink,
        calendarEmbed: data.calendarEmbed,
        email: data.email,
        phone: data.phone,
        address: data.address,
        duration: data.duration,
        notes: data.notes,
        status: data.status,
        ghlContactId: data.ghlContactId,
        companyName: data.companyName,
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

