import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * The Auth.js v5 user record, extended with SuperBad preference columns.
 * A8 wires NextAuth against this shape; this session only lands the schema.
 *
 * `role` is the coarse access bucket consumed by `lib/auth/permissions.ts`
 * (admin / client / prospect / anonymous / system). `system` is for
 * cron-initiated actions and is never attached to an interactive user row.
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  emailVerified: integer("email_verified_ms"),
  image: text("image"),

  role: text("role", {
    enum: ["admin", "client", "prospect", "anonymous"],
  })
    .notNull()
    .default("prospect"),

  timezone: text("timezone").notNull().default("Australia/Melbourne"),

  motion_preference: text("motion_preference", {
    enum: ["full", "reduced", "off"],
  })
    .notNull()
    .default("full"),
  sounds_enabled: integer("sounds_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  density_preference: text("density_preference", {
    enum: ["compact", "comfortable", "spacious"],
  })
    .notNull()
    .default("comfortable"),
  text_size_preference: text("text_size_preference", {
    enum: ["small", "default", "large"],
  })
    .notNull()
    .default("default"),
  theme_preset: text("theme_preset").notNull().default("base-nova"),
  typeface_preset: text("typeface_preset").notNull().default("default"),

  first_signed_in_at_ms: integer("first_signed_in_at_ms"),
  created_at_ms: integer("created_at_ms").notNull(),
});

export type UserRow = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
