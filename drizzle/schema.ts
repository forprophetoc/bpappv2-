import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  /** Service type: bathtub | shower | jacuzzi | epoxy | cabinet */
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
  /** Epoxy-specific fields */
  baseColor: text("baseColor"),
  flakeColor: text("flakeColor"),
  maintenancePlanPrice: integer("maintenancePlanPrice"),
  uvClearCoatPrice: integer("uvClearCoatPrice"),
  /** Cabinet-specific fields */
  upperCabinetColor: text("upperCabinetColor"),
  lowerCabinetColor: text("lowerCabinetColor"),
  softCloseHingeUpgrade: integer("softCloseHingeUpgrade"),
  hardwareReplacement: integer("hardwareReplacement"),
  hardwareUpgrade: integer("hardwareUpgrade"),
  /** Strip fee — charged to remove previous coating */
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
  companyName: text("companyName"),
  companyLogoUrl: text("companyLogoUrl"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(unixepoch())`)
    .notNull(),
});

export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = typeof estimates.$inferInsert;
