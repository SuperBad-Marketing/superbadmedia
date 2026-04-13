import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Audit table for GDPR cookie consent decisions.
 *
 * Only written for EU visitors (detected via `isEuIp()` in the legal layout).
 * Non-EU visitors see a footer link only — no row written.
 *
 * Consent state is also held in `localStorage` (`sb_cookie_consent`) for
 * client-side reads without a round-trip.
 *
 * Owner: B3. Consumer: compliance reporting (Wave 22 SAP).
 */
export const COOKIE_CATEGORIES = [
  "necessary",
  "functional",
  "analytics",
] as const;

export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];

export const cookie_consents = sqliteTable(
  "cookie_consents",
  {
    id: text("id").primaryKey(),
    /** SHA-256 of client IP — no raw IP stored (privacy by design). */
    ip_hash: text("ip_hash").notNull(),
    /** Nullable — anonymous visitors don't have a user_id. */
    user_id: text("user_id"),
    /** true = accepted all (or custom categories), false = rejected all. */
    accepted: integer("accepted", { mode: "boolean" }).notNull(),
    /** JSON-encoded string[]. Accepted category IDs. */
    categories: text("categories").notNull(),
    /** Version string matching the cookie-policy doc at time of consent. */
    banner_version: text("banner_version").notNull(),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_ip: index("cookie_consents_ip_idx").on(t.ip_hash, t.created_at_ms),
    by_user: index("cookie_consents_user_idx").on(t.user_id, t.created_at_ms),
  }),
);

export type CookieConsentRow = typeof cookie_consents.$inferSelect;
export type CookieConsentInsert = typeof cookie_consents.$inferInsert;
