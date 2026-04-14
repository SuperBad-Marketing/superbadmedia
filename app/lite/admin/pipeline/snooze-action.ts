"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { snoozeDeal } from "@/lib/crm";

/**
 * Server Action — wraps `snoozeDeal` with admin auth + path revalidation.
 * Returns a discriminated result so the client can toast success/error.
 */
export async function snoozeDealAction(
  dealId: string,
  untilMs: number,
): Promise<{ ok: true; untilMs: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  if (!Number.isFinite(untilMs) || untilMs <= Date.now()) {
    return { ok: false, error: "Snooze date must be in the future." };
  }
  try {
    snoozeDeal(dealId, untilMs, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath("/lite/admin/pipeline");
    return { ok: true, untilMs };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Snooze failed.",
    };
  }
}
