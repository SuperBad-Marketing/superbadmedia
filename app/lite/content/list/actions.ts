"use server";

/**
 * List tab server actions (CE-11).
 *
 * Admin-role-gated. CSV import + CSV export.
 */
import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  importSubscribersFromCsv,
  exportSubscribersCsv,
} from "@/lib/content-engine/subscriber-list";

// ── CSV Import ──────────────────────────────────────────────────────────────

const importRowSchema = z.object({
  email: z.string().min(1).max(500),
  name: z.string().max(500).optional(),
});

const importSchema = z.object({
  companyId: z.string().uuid(),
  rows: z.array(importRowSchema).min(1).max(10000),
});

export async function importSubscribersAction(
  companyId: string,
  rows: Array<{ email: string; name?: string }>,
): Promise<
  | { ok: true; imported: number; skipped: number; duplicates: number }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = importSchema.safeParse({ companyId, rows });
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const result = await importSubscribersFromCsv(
    parsed.data.companyId,
    parsed.data.rows,
  );

  revalidatePath("/lite/content/list");

  return {
    ok: true,
    imported: result.imported,
    skipped: result.skipped,
    duplicates: result.duplicates,
  };
}

// ── CSV Export ───────────────────────────────────────────────────────────────

export async function exportSubscribersAction(
  companyId: string,
): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = z.string().uuid().safeParse(companyId);
  if (!parsed.success) return { ok: false, error: "invalid_company_id" };

  const csv = await exportSubscribersCsv(parsed.data);
  return { ok: true, csv };
}
