"use server";

import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { trial_tasks } from "@/lib/db/schema/trial-tasks";
import { contractor_invoices } from "@/lib/db/schema/contractor-invoices";
import { candidate_edit_requests } from "@/lib/db/schema/candidate-edit-requests";
import { getBenchSession } from "@/lib/bench/guard";
import { logActivity } from "@/lib/activity-log";
import { vault } from "@/lib/crypto/vault";
import { enqueueBenchPauseEnding } from "@/lib/hiring/bench-pause";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function submitDeliverableAction(
  taskId: string,
  deliveryUrl: string,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const url = deliveryUrl.trim();
  if (!url) return { ok: false, error: "Delivery URL is required" };

  const task = db
    .select({ id: trial_tasks.id, candidate_id: trial_tasks.candidate_id })
    .from(trial_tasks)
    .where(
      and(
        eq(trial_tasks.id, taskId),
        eq(trial_tasks.candidate_id, session.candidateId),
      ),
    )
    .get();

  if (!task) return { ok: false, error: "Task not found" };

  const now = Date.now();

  await db
    .update(trial_tasks)
    .set({
      delivery_url_or_asset: url,
      delivered_at_ms: now,
      disposition: "shipped",
      updated_at_ms: now,
    })
    .where(eq(trial_tasks.id, taskId));

  await logActivity({
    kind: "contractor_deliverable_submitted",
    body: `Deliverable submitted for task`,
    meta: { candidate_id: session.candidateId, task_id: taskId },
  });

  return { ok: true };
}

export async function submitInvoiceAction(
  amountAud: number,
  reference: string,
  notes?: string,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (amountAud <= 0) return { ok: false, error: "Amount must be positive" };

  const ref = reference.trim();
  if (!ref) return { ok: false, error: "Invoice reference is required" };

  const now = Date.now();

  await db.insert(contractor_invoices).values({
    id: randomUUID(),
    candidate_id: session.candidateId,
    amount_aud: amountAud,
    reference: ref,
    notes: notes?.trim() || null,
    status: "submitted",
    submitted_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await logActivity({
    kind: "contractor_invoice_submitted",
    body: `Invoice submitted: $${amountAud} (${ref})`,
    meta: { candidate_id: session.candidateId, amount_aud: amountAud },
  });

  return { ok: true };
}

export async function togglePauseAction(
  pause: boolean,
  pausedUntilMs?: number,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const now = Date.now();

  if (pause) {
    await db
      .update(candidates)
      .set({
        bench_status: "paused",
        paused_until_ms: pausedUntilMs ?? null,
        updated_at_ms: now,
      })
      .where(eq(candidates.id, session.candidateId));

    if (pausedUntilMs) {
      await enqueueBenchPauseEnding(session.candidateId, pausedUntilMs);
    }
  } else {
    await db
      .update(candidates)
      .set({
        bench_status: "active",
        paused_until_ms: null,
        updated_at_ms: now,
      })
      .where(eq(candidates.id, session.candidateId));
  }

  await logActivity({
    kind: "contractor_pause_toggled",
    body: pause ? "Contractor paused" : "Contractor resumed",
    meta: { candidate_id: session.candidateId, paused: pause },
  });

  return { ok: true };
}

export async function updateCapacityAction(
  weeklyCapacityHours: number,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  if (weeklyCapacityHours <= 0 || weeklyCapacityHours > 168) {
    return { ok: false, error: "Weekly capacity must be 1–168 hours" };
  }

  await db
    .update(candidates)
    .set({
      weekly_capacity_hours: weeklyCapacityHours,
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, session.candidateId));

  await logActivity({
    kind: "contractor_availability_updated",
    body: `Weekly capacity updated to ${weeklyCapacityHours}h`,
    meta: {
      candidate_id: session.candidateId,
      weekly_capacity_hours: weeklyCapacityHours,
    },
  });

  return { ok: true };
}

export async function requestProfileEditAction(
  fieldName: string,
  newValue: string,
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const val = newValue.trim();
  if (!val) return { ok: false, error: "New value is required" };

  const allowedFields = [
    "hourly_rate_aud",
    "abn",
    "legal_name",
    "bank_details",
  ];
  if (!allowedFields.includes(fieldName)) {
    return { ok: false, error: "Invalid field" };
  }

  const candidate = db
    .select({
      hourly_rate_aud: candidates.hourly_rate_aud,
      abn: candidates.abn,
      legal_name: candidates.legal_name,
    })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate) return { ok: false, error: "Not found" };

  const oldValue =
    fieldName === "hourly_rate_aud"
      ? String(candidate.hourly_rate_aud ?? "")
      : fieldName === "abn"
        ? candidate.abn ?? ""
        : fieldName === "legal_name"
          ? candidate.legal_name ?? ""
          : "(encrypted)";

  const now = Date.now();

  await db.insert(candidate_edit_requests).values({
    id: randomUUID(),
    candidate_id: session.candidateId,
    field_name: fieldName,
    old_value: oldValue,
    new_value: val,
    status: "pending",
    created_at_ms: now,
  });

  await logActivity({
    kind: "contractor_profile_edit_requested",
    body: `Edit requested: ${fieldName}`,
    meta: { candidate_id: session.candidateId, field: fieldName },
  });

  return { ok: true };
}

export async function updatePortfolioUrlsAction(
  urls: string[],
): Promise<ActionResult> {
  const session = await getBenchSession();
  if (!session) return { ok: false, error: "Not authenticated" };

  const cleaned = urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  await db
    .update(candidates)
    .set({
      portfolio_urls_json: cleaned,
      portfolio_signal_fetched_at_ms: null,
      updated_at_ms: Date.now(),
    })
    .where(eq(candidates.id, session.candidateId));

  await logActivity({
    kind: "contractor_portfolio_updated",
    body: `Portfolio URLs updated (${cleaned.length} URLs)`,
    meta: { candidate_id: session.candidateId, count: cleaned.length },
  });

  return { ok: true };
}
