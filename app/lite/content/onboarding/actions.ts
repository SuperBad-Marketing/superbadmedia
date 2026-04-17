"use server";

/**
 * Content Engine onboarding wizard server actions (CE-12).
 *
 * Spec: docs/specs/content-engine.md §3.3.
 * Owner: CE-12.
 */
import { z } from "zod";
import { auth } from "@/lib/auth/session";
import { SEND_WINDOW_DAYS } from "@/lib/db/schema/content-engine-config";
import {
  deriveSeedKeywords,
  ensureContentEngineConfig,
  completeContentEngineOnboarding,
} from "@/lib/content-engine/onboarding";
import { importSubscribersFromCsv } from "@/lib/content-engine/subscriber-list";
import type { DerivedSeedKeywords } from "@/lib/content-engine/onboarding";

// ── Schemas ─────────────────────────────────────────────────────────────────

const completeOnboardingSchema = z.object({
  companyId: z.string().min(1),
  seedKeywords: z.array(z.string().min(1)).min(1),
  sendWindowDay: z.enum(SEND_WINDOW_DAYS),
  sendWindowTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  sendWindowTz: z.string().min(1),
  csvData: z.string().optional(),
});

// ── Actions ─────────────────────────────────────────────────────────────────

/**
 * Initialise the onboarding wizard — ensures config row exists and derives
 * seed keywords from Brand DNA.
 */
export async function initOnboardingAction(companyId: string): Promise<
  | { ok: true; seedKeywords: DerivedSeedKeywords; configId: string }
  | { ok: false; error: string }
> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return { ok: false, error: "Unauthorized." };
  }

  if (!companyId?.trim()) {
    return { ok: false, error: "Company ID is required." };
  }

  const config = await ensureContentEngineConfig(companyId);
  const seedKeywords = await deriveSeedKeywords(companyId);

  return { ok: true, seedKeywords, configId: config.id };
}

/**
 * Complete the onboarding wizard — saves preferences, imports CSV if provided,
 * kicks off the content pipeline.
 */
export async function completeOnboardingAction(
  input: z.infer<typeof completeOnboardingSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = completeOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { companyId, seedKeywords, sendWindowDay, sendWindowTime, sendWindowTz, csvData } =
    parsed.data;

  // Import CSV if provided
  let csvImported = false;
  if (csvData) {
    const rows = csvData
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        // Simple CSV parse — matches the csv-import step's client-side parse
        const parts: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            parts.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        parts.push(current.trim());
        return parts;
      });

    if (rows.length > 1) {
      const header = rows[0]!;
      const emailIdx = header.findIndex((h) => h.toLowerCase().includes("email"));
      const nameIdx = header.findIndex((h) => h.toLowerCase().includes("name"));

      if (emailIdx >= 0) {
        const contacts = rows.slice(1).map((row) => ({
          email: row[emailIdx] ?? "",
          name: nameIdx >= 0 ? (row[nameIdx] ?? undefined) : undefined,
        }));

        await importSubscribersFromCsv(companyId, contacts);
        csvImported = true;
      }
    }
  }

  const result = await completeContentEngineOnboarding(companyId, {
    domainVerified: true,
    seedKeywordsConfirmed: seedKeywords,
    sendWindowDay,
    sendWindowTime,
    sendWindowTz,
    csvImported,
    embedFormTokenGenerated: true,
    completedAt: Date.now(),
  });

  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  return { ok: true };
}
