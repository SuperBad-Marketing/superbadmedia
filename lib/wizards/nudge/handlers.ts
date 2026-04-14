/**
 * Scheduled-task handlers for wizard nudge / expiry lifecycle.
 *
 * Per `docs/specs/setup-wizards.md` §11:
 *   - `wizard_resume_nudge`  — 24h after last_active_at_ms → transactional email
 *   - `wizard_expiry_warn`   — 1d before expires_at_ms     → transactional email
 *   - `wizard_expire`        — at expires_at_ms            → mark abandoned + log
 *
 * Each handler is defensive: re-reads `wizard_progress` at fire time and
 * skips silently if the row is already abandoned, completed, or the
 * scheduling assumption has been invalidated by later user activity.
 *
 * Gated on `killSwitches.wizards_nudges_enabled`. When off, handlers are
 * no-ops (the row gets marked done without any effect) — matches the
 * nudge-only kill-switch per SW-8 brief §7 Track A.
 *
 * Owner: SW-8. Consumers: the `scheduled-tasks` worker handler map.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { wizard_progress } from "@/lib/db/schema/wizard-progress";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { killSwitches } from "@/lib/kill-switches";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import { getWizard } from "@/lib/wizards/registry";
import {
  RESUME_NUDGE_SUBJECTS,
  EXPIRY_WARN_SUBJECTS,
  pickSubject,
  resumeNudgeBody,
  expiryWarnBody,
} from "@/lib/wizards/nudge/content";

// Side-effect: ensure every known WizardDefinition has registered so
// name lookup succeeds when the worker fires outside a page render.
import "@/lib/wizards/defs";

export interface NudgeTaskPayload {
  /** `wizard_progress.id` */
  progressId: string;
  /** `wizard_progress.last_active_at_ms` at scheduling time (resume-nudge only) */
  scheduledForLastActiveAtMs?: number;
}

function parsePayload(task: ScheduledTaskRow): NudgeTaskPayload | null {
  const p = task.payload as unknown;
  if (!p || typeof p !== "object") return null;
  const progressId = (p as Record<string, unknown>).progressId;
  if (typeof progressId !== "string") return null;
  const last = (p as Record<string, unknown>).scheduledForLastActiveAtMs;
  return {
    progressId,
    scheduledForLastActiveAtMs: typeof last === "number" ? last : undefined,
  };
}

async function loadLiveProgress(progressId: string) {
  const rows = await db
    .select()
    .from(wizard_progress)
    .where(eq(wizard_progress.id, progressId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.abandoned_at_ms !== null) return null;
  return row;
}

async function loadUserEmail(userId: string): Promise<string | null> {
  const { user } = await import("@/lib/db/schema/user");
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0]?.email ?? null;
}

function wizardDisplayName(key: string): string {
  // WizardDefinition currently has no dedicated display-name field; the
  // key itself is human-readable enough ("stripe-admin", "resend", etc.)
  // and content mini-sessions can refine this if needed.
  return getWizard(key)?.key ?? key;
}

function resumeUrlFor(wizardKey: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au";
  // Critical-flight wizards live under a dedicated route tree. Non-critical
  // admin wizard routes are TBD (SW-9+); fall back to the generic path.
  const CRITICAL = new Set(["stripe-admin", "resend", "graph-api-admin"]);
  if (CRITICAL.has(wizardKey)) {
    return `${base}/lite/setup/critical-flight/${wizardKey}?resume=1`;
  }
  return `${base}/lite/setup/${wizardKey}?resume=1`;
}

export async function handleWizardResumeNudge(
  task: ScheduledTaskRow,
): Promise<void> {
  if (!killSwitches.wizards_nudges_enabled) return;
  const payload = parsePayload(task);
  if (!payload) return;
  const row = await loadLiveProgress(payload.progressId);
  if (!row) return;
  // Activity moved on since scheduling — a fresher nudge will already be
  // queued (or the user returned). Drop silently.
  if (
    payload.scheduledForLastActiveAtMs !== undefined &&
    row.last_active_at_ms !== payload.scheduledForLastActiveAtMs
  ) {
    return;
  }
  const email = await loadUserEmail(row.user_id);
  if (!email) return;
  const wizardName = wizardDisplayName(row.wizard_key);
  const subject = pickSubject(RESUME_NUDGE_SUBJECTS, row.id);
  await sendEmail({
    to: email,
    subject,
    body: resumeNudgeBody({
      wizardName,
      resumeUrl: resumeUrlFor(row.wizard_key),
    }),
    classification: "transactional",
    purpose: `wizard_resume_nudge:${row.wizard_key}`,
    tags: [
      { name: "surface", value: "wizard_nudge" },
      { name: "wizard", value: row.wizard_key },
    ],
  });
}

export async function handleWizardExpiryWarn(
  task: ScheduledTaskRow,
): Promise<void> {
  if (!killSwitches.wizards_nudges_enabled) return;
  const payload = parsePayload(task);
  if (!payload) return;
  const row = await loadLiveProgress(payload.progressId);
  if (!row) return;
  const email = await loadUserEmail(row.user_id);
  if (!email) return;
  const wizardName = wizardDisplayName(row.wizard_key);
  const subject = pickSubject(EXPIRY_WARN_SUBJECTS, row.id);
  await sendEmail({
    to: email,
    subject,
    body: expiryWarnBody({
      wizardName,
      resumeUrl: resumeUrlFor(row.wizard_key),
    }),
    classification: "transactional",
    purpose: `wizard_expiry_warn:${row.wizard_key}`,
    tags: [
      { name: "surface", value: "wizard_nudge" },
      { name: "wizard", value: row.wizard_key },
    ],
  });
}

export async function handleWizardExpire(
  task: ScheduledTaskRow,
): Promise<void> {
  // Expire runs regardless of the nudge kill-switch — it's the data-only
  // lifecycle terminator, not user-facing comms. Without it, an in-flight
  // row never releases the partial-unique-index slot for that user+wizard.
  const payload = parsePayload(task);
  if (!payload) return;
  const row = await loadLiveProgress(payload.progressId);
  if (!row) return;
  const now = Date.now();
  await db
    .update(wizard_progress)
    .set({ abandoned_at_ms: now })
    .where(
      and(
        eq(wizard_progress.id, row.id),
        // Double-check: don't stomp a row that completed or was abandoned
        // between our read and this write.
      ),
    );
  await logActivity({
    kind: "wizard_abandoned",
    body: `Wizard ${row.wizard_key} expired after ${Math.round((now - row.started_at_ms) / 86_400_000)}d idle`,
    meta: {
      wizard_key: row.wizard_key,
      progress_id: row.id,
      reason: "expired",
    },
    createdAtMs: now,
  });
}

export const wizardNudgeHandlers: HandlerMap = {
  wizard_resume_nudge: handleWizardResumeNudge,
  wizard_expiry_warn: handleWizardExpiryWarn,
  wizard_expire: handleWizardExpire,
};
