"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { getBenchSession } from "@/lib/bench/guard";
import { vault } from "@/lib/crypto/vault";
import { logActivity } from "@/lib/activity-log";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveAbnLegalNameAction(
  abn: string,
  legalName: string,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const trimmedAbn = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(trimmedAbn)) {
    return { ok: false, error: "ABN must be 11 digits" };
  }

  if (!legalName.trim()) {
    return { ok: false, error: "Legal name is required" };
  }

  await db
    .update(candidates)
    .set({
      abn: trimmedAbn,
      legal_name: legalName.trim(),
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, session.candidateId));

  return { ok: true };
}

export async function saveAgreementAction(): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  await db
    .update(candidates)
    .set({
      agreement_signed_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, session.candidateId));

  return { ok: true };
}

export async function saveBankDetailsAction(
  bsb: string,
  accountNumber: string,
  accountName: string,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const trimmedBsb = bsb.replace(/[^0-9]/g, "");
  if (!/^\d{6}$/.test(trimmedBsb)) {
    return { ok: false, error: "BSB must be 6 digits" };
  }

  const trimmedAccount = accountNumber.replace(/[^0-9]/g, "");
  if (trimmedAccount.length < 5 || trimmedAccount.length > 10) {
    return { ok: false, error: "Account number must be 5–10 digits" };
  }

  if (!accountName.trim()) {
    return { ok: false, error: "Account name is required" };
  }

  const bankJson = JSON.stringify({
    bsb: trimmedBsb,
    account_number: trimmedAccount,
    account_name: accountName.trim(),
  });

  const encrypted = vault.encrypt(bankJson, "candidate.bank_details");

  await db
    .update(candidates)
    .set({
      bank_details: encrypted,
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, session.candidateId));

  return { ok: true };
}

export async function completeOnboardingAction(
  hourlyRateAud: number,
  weeklyCapacityHours: number,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (hourlyRateAud <= 0) {
    return { ok: false, error: "Rate must be positive" };
  }
  if (weeklyCapacityHours <= 0 || weeklyCapacityHours > 168) {
    return { ok: false, error: "Weekly capacity must be 1–168 hours" };
  }

  const candidate = db
    .select({
      abn: candidates.abn,
      agreement_signed_at_ms: candidates.agreement_signed_at_ms,
      bank_details: candidates.bank_details,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate) return { ok: false, error: "Candidate not found" };
  if (!candidate.abn) return { ok: false, error: "ABN not set" };
  if (!candidate.agreement_signed_at_ms) return { ok: false, error: "Agreement not signed" };
  if (!candidate.bank_details) return { ok: false, error: "Bank details not set" };

  const now = Date.now();

  await db
    .update(candidates)
    .set({
      hourly_rate_aud: hourlyRateAud,
      weekly_capacity_hours: weeklyCapacityHours,
      bench_status: "active",
      onboarding_completed_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(candidates.id, session.candidateId));

  await logActivity({
    kind: "contractor_onboarding_completed",
    body: `Contractor onboarding completed`,
    meta: { candidate_id: session.candidateId },
  });

  return { ok: true };
}
