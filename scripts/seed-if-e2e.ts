/**
 * IF-E2E fixtures — deterministic, idempotent.
 *
 * Seeds the `intro_funnel_config` singleton row so the payment action
 * has a known price ($297 AUD). No other seeding needed — the E2E drives
 * the actual landing → section 1 → questionnaire → payment flow, which
 * creates all CRM entities via the live Server Actions.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedIfE2e(db)`
 *   - CLI: DB_FILE_PATH=./dev.db npx tsx scripts/seed-if-e2e.ts
 *
 * Owner: IF-E2E. Consumer: tests/e2e/intro-funnel-booking.spec.ts.
 */
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { intro_funnel_config } from "@/lib/db/schema/intro-funnel-config";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const IF_E2E = {
  priceCents: 29700,
  currency: "aud",
} as const;

export async function seedIfE2e(db: DB): Promise<void> {
  const now = Date.now();

  const existing = await db
    .select()
    .from(intro_funnel_config)
    .where(eq(intro_funnel_config.id, "singleton"))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(intro_funnel_config).values({
      id: "singleton",
      price_cents: IF_E2E.priceCents,
      currency: IF_E2E.currency,
      updated_at_ms: now,
    });
  }
}

// CLI entrypoint
if (process.argv[1]?.endsWith("seed-if-e2e.ts")) {
  const Database = (await import("better-sqlite3")).default;
  const { drizzle: makeDrizzle } = await import("drizzle-orm/better-sqlite3");
  const dbPath = process.env.DB_FILE_PATH ?? "./dev.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = makeDrizzle(sqlite, { schema });
  await seedIfE2e(db);
  sqlite.close();
  console.log("IF-E2E seed complete.");
}
