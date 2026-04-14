import { sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { sequences } from "@/lib/db/schema/sequences";

/**
 * Quote number format: `SB-YYYY-NNNN` (e.g. `SB-2026-0042`). Sequence
 * resets per calendar year (year is encoded into the sequence key so
 * year rollover starts a fresh counter). Allocation is atomic: the
 * increment happens inside a transaction using `RETURNING`, so two
 * concurrent callers cannot collide.
 */
const QUOTE_NUMBER_PAD = 4;

type DatabaseLike = typeof defaultDb;

function sequenceName(year: number): string {
  return `quote_number:${year}`;
}

function formatQuoteNumber(year: number, value: number): string {
  return `SB-${year}-${String(value).padStart(QUOTE_NUMBER_PAD, "0")}`;
}

/**
 * Allocate the next quote number for the given year (default: current
 * calendar year). Returns a human-readable string like `SB-2026-0001`.
 *
 * Safe to call concurrently — the counter upsert + increment run in a
 * single SQL statement.
 */
export async function allocateQuoteNumber(
  opts: { year?: number; db?: DatabaseLike } = {},
): Promise<string> {
  const year = opts.year ?? new Date().getUTCFullYear();
  const db = opts.db ?? defaultDb;
  const name = sequenceName(year);

  const rows = await db
    .insert(sequences)
    .values({ name, current_value: 1 })
    .onConflictDoUpdate({
      target: sequences.name,
      set: { current_value: sql`${sequences.current_value} + 1` },
    })
    .returning({ value: sequences.current_value });

  const value = rows[0]?.value;
  if (typeof value !== "number") {
    throw new Error("quote_number allocation failed: no row returned");
  }
  return formatQuoteNumber(year, value);
}
