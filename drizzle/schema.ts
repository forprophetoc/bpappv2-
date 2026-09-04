import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** URL-safe slug matching the config filename, e.g. "bathtub-pros" */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Stripe mapping — populated by webhook on subscription activation */
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  stripeSubscriptionItemId: text("stripeSubscriptionItemId"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  /** "user" | "admin" */
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const estimates = sqliteTable("estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** URL-safe slug derived from customer name, e.g. "john-doe-april" */
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  service: text("service").notNull(),
  /** Service type: bathtub | shower | jacuzzi */
  serviceType: text("serviceType").notNull().default("bathtub"),
  price: integer("price").notNull(),
  beforeUrl: text("beforeUrl").notNull(),
  afterUrl: text("afterUrl").notNull(),
  /** Transformation image — bathtub only */
  transformationImageUrl: text("transformationImageUrl"),
  /** Pricing fields */
  transformationPrice: integer("transformationPrice"),
  bathroomSinkPrice: integer("bathroomSinkPrice"),
  kitchenSinkPrice: integer("kitchenSinkPrice"),
  tileSurroundPrice: integer("tileSurroundPrice"),
  otherBathroomPrice: integer("otherBathroomPrice"),
  stripFee: integer("stripFee"),
  /** Booking — if bookingLink exists, render button; else render calendarEmbed */
  bookingLink: text("bookingLink"),
  calendarEmbed: text("calendarEmbed"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  duration: text("duration").default("3 Hours"),
  notes: text("notes"),
  status: text("status").default("New Lead"),
  viewedAt: integer("viewedAt", { mode: "timestamp" }),
  ghlContactId: text("ghlContactId"),
  /** Multi-tenant isolation */
  companyId: integer("companyId"),
  companySlug: text("companySlug"),
  companyLogoUrl: text("companyLogoUrl"),
  /** Immutable DB insertion timestamp — used for billing cycle counting */
  insertedAt: integer("insertedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
}, (t) => ({
  // Perf: the dashboard/all-jobs list orders by createdAt DESC — without this
  // index SQLite does a full SCAN + a TEMP B-TREE sort on every load.
  createdAtIdx: index("idx_estimates_createdAt").on(t.createdAt),
  // Perf: dashboard status counts (COUNT(*) ... GROUP BY status).
  statusIdx: index("idx_estimates_status").on(t.status),
  // Perf: GHL contact lookups.
  ghlContactIdIdx: index("idx_estimates_ghlContactId").on(t.ghlContactId),
}));

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;

export const usageEvents = sqliteTable("usage_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("companyId").notNull(),
  estimateId: integer("estimateId").notNull(),
  /** Unique per estimate — idempotency key to prevent double-billing */
  estimateSlug: text("estimateSlug").notNull().unique(),
  /** Position in current billing cycle (e.g. 101, 102...) */
  sequenceNum: integer("sequenceNum").notNull(),
  /** Stripe billing period boundaries (unix seconds) */
  periodStart: integer("periodStart").notNull(),
  periodEnd: integer("periodEnd").notNull(),
  /** Stripe response after successful usage report */
  stripeUsageRecordId: text("stripeUsageRecordId"),
  reportedAt: integer("reportedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type UsageEvent = typeof usageEvents.$inferSelect;
