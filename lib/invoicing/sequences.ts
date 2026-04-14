import { sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { sequences } from "@/lib/db/schema/sequences";

/**
 * Invoice number format: `SB-INV-YYYY-NNNN` (e.g. `SB-INV-2026-0001`).
 * Year-scoped sequence sharing the `sequences` table with quote
 * numbers. Allocation is atomic via upsert + increment in a single SQL
 * statement (parallel to `lib/quote-builder/sequences.ts`).
 */
const INVOICE_NUMBER_PAD = 4;

type DatabaseLike = typeof defaultDb;

function sequenceName(year: number): string {
  return `invoice_number:${year}`;
}

function formatInvoiceNumber(year: number, value: number): string {
  return `SB-INV-${year}-${String(value).padStart(INVOICE_NUMBER_PAD, "0")}`;
}

export async function allocateInvoiceNumber(
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
    throw new Error("invoice_number allocation failed: no row returned");
  }
  return formatInvoiceNumber(year, value);
}
