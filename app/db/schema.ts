import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigint,
  index,
} from "drizzle-orm/pg-core";

// Required by @shopify/shopify-app-session-storage-drizzle
export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  scope: text("scope"),
  expires: timestamp("expires", { mode: "date" }),
  accessToken: text("accessToken").notNull(),
  userId: bigint("userId", { mode: "number" }),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email"),
  accountOwner: boolean("accountOwner"),
  locale: text("locale"),
  collaborator: boolean("collaborator"),
  emailVerified: boolean("emailVerified"),
  refreshToken: text("refreshToken"),
  refreshTokenExpires: timestamp("refreshTokenExpires", { mode: "date" }),
});

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  plan: text("plan").notNull().default("free"),
  settings: jsonb("settings").default({}),
  productLimit: integer("product_limit").notNull().default(25),
  trackedCount: integer("tracked_count").notNull().default(0),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
});

// Append-only price history. One row per (variant, market) price observation,
// captured from products/create|update webhooks or the daily snapshot backup.
// Prices are integer minor units (cents) to avoid float drift.
// market: Shopify market handle/country key (e.g. "DE", "US", "default").
// currency: ISO 4217 code of the price.
// source: "webhook" | "snapshot" | "backfill".
export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: serial("id").primaryKey(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    variantId: text("variant_id").notNull(),
    market: text("market").notNull().default("default"),
    currency: text("currency").notNull().default("USD"),
    priceMinor: integer("price_minor").notNull(),
    compareAtMinor: integer("compare_at_minor"),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    source: text("source").notNull().default("webhook"),
  },
  (t) => [
    // Lowest-price lookups: all snapshots for a variant+market, newest first.
    index("price_snapshots_lookup_idx").on(
      t.shopId,
      t.productId,
      t.variantId,
      t.market,
      t.capturedAt,
    ),
    // Shop-wide purges (uninstall/redact) and exports.
    index("price_snapshots_shop_idx").on(t.shopId, t.capturedAt),
  ],
);

export type Shop = typeof shops.$inferSelect;
export type PriceSnapshot = typeof priceSnapshots.$inferSelect;
export type NewPriceSnapshot = typeof priceSnapshots.$inferInsert;
