import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

/**
 * Runtime band overrides. When Andy adjusts a job's per-call ceiling,
 * daily ceiling, or learned-band multiplier via the band editor, the
 * new values land here. `getEffectiveBands()` merges these over the
 * code-time defaults in `job-registry.ts`.
 *
 * Spec: `docs/specs/cost-usage-observatory.md` §3.4 + §5.5.
 * Owner: COB-7 (Wave 21).
 */
export const band_overrides = sqliteTable("band_overrides", {
  job: text("job").primaryKey(),
  per_call_ceiling_aud: real("per_call_ceiling_aud"),
  daily_ceiling_aud: real("daily_ceiling_aud"),
  learned_band_multiplier: real("learned_band_multiplier"),
  updated_at_ms: integer("updated_at_ms").notNull(),
});

export type BandOverrideRow = typeof band_overrides.$inferSelect;
export type BandOverrideInsert = typeof band_overrides.$inferInsert;
