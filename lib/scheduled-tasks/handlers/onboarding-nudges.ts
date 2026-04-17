/**
 * Scheduled-task handlers for onboarding nudge emails.
 *
 * Two task types per BUILD_PLAN §C:
 *   - `onboarding_nudge_email`        — non-start nudges (SaaS + retainer)
 *   - `practical_setup_reminder_email` — practical setup reminders (retainer-only)
 *
 * Both are defensive: re-read state at fire time and skip if the target
 * step is already complete. Both self-re-enqueue at the configured cadence
 * so the chain continues until the customer completes or the nudge limit
 * is exhausted.
 *
 * Spec: onboarding-and-segmentation.md §7.3, §7.4.
 * Owner: OS-2.
 */
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import settingsRegistry from "@/lib/settings";
import { killSwitches } from "@/lib/kill-switches";

// ── Payload types ─────────────────────────────────────────────────────

export interface OnboardingNudgePayload {
  contactId: string;
  companyId: string;
  audience: "retainer" | "saas";
  /** Which nudge in the sequence (0-indexed). */
  nudgeIndex: number;
}

export interface PracticalSetupReminderPayload {
  contactId: string;
  companyId: string;
  /** Which reminder in the sequence (0-indexed). */
  reminderIndex: number;
}

function parseOnboardingNudge(task: ScheduledTaskRow): OnboardingNudgePayload | null {
  const p = task.payload as unknown;
  if (!p || typeof p !== "object") return null;
  const { contactId, companyId, audience, nudgeIndex } = p as Record<string, unknown>;
  if (typeof contactId !== "string" || typeof companyId !== "string") return null;
  if (audience !== "retainer" && audience !== "saas") return null;
  return {
    contactId,
    companyId,
    audience,
    nudgeIndex: typeof nudgeIndex === "number" ? nudgeIndex : 0,
  };
}

function parsePracticalSetup(task: ScheduledTaskRow): PracticalSetupReminderPayload | null {
  const p = task.payload as unknown;
  if (!p || typeof p !== "object") return null;
  const { contactId, companyId, reminderIndex } = p as Record<string, unknown>;
  if (typeof contactId !== "string" || typeof companyId !== "string") return null;
  return {
    contactId,
    companyId,
    reminderIndex: typeof reminderIndex === "number" ? reminderIndex : 0,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

async function getContactEmail(contactId: string): Promise<string | null> {
  const row = db
    .select({ email: contacts.email })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .get();
  return row?.email ?? null;
}

function isBrandDnaComplete(contactId: string): boolean {
  const profile = db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, contactId),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
        isNotNull(brand_dna_profiles.completed_at_ms),
      ),
    )
    .get();
  return profile != null;
}

function isRevSegComplete(companyId: string): boolean {
  const co = db
    .select({ revenue_segmentation_completed_at_ms: companies.revenue_segmentation_completed_at_ms })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  return co?.revenue_segmentation_completed_at_ms != null;
}

const PRACTICAL_KEYS = [
  "practical-contact-details",
  "practical-ad-accounts",
  "practical-content-archive",
] as const;

function getIncompletePracticalSteps(contactId: string): string[] {
  const completed = db
    .select({ wizard_key: wizard_completions.wizard_key })
    .from(wizard_completions)
    .where(eq(wizard_completions.user_id, contactId))
    .all();
  const completedSet = new Set(completed.map((r) => r.wizard_key));
  return PRACTICAL_KEYS.filter((k) => !completedSet.has(k));
}

const STEP_LABELS: Record<string, string> = {
  "practical-contact-details": "contact details",
  "practical-ad-accounts": "ad account access",
  "practical-content-archive": "content archive links",
};

// ── onboarding_nudge_email handler ────────────────────────────────────

async function handleOnboardingNudge(task: ScheduledTaskRow): Promise<void> {
  if (!killSwitches.onboarding_nudges_enabled) return;

  const payload = parseOnboardingNudge(task);
  if (!payload) return;

  const { contactId, companyId, audience, nudgeIndex } = payload;

  // Re-read state: is onboarding still pending?
  const bdDone = isBrandDnaComplete(contactId);
  if (audience === "saas") {
    const rsDone = isRevSegComplete(companyId);
    // If both brand DNA and rev seg are done, onboarding isn't "non-started"
    if (bdDone && rsDone) return;
  } else {
    // Retainer: one nudge at 24h, then cockpit flag (no further automated nudges).
    if (bdDone) return;
    if (nudgeIndex > 0) return; // only one retainer nudge
  }

  const email = await getContactEmail(contactId);
  if (!email) return;

  // Determine subject + body based on progress
  let subject: string;
  let body: string;

  if (!bdDone) {
    subject = "Pick up where you left off";
    body = `<p>You started getting to know SuperBad — and we're keen to finish the conversation.</p><p>The Brand DNA setup takes about 30 minutes. It's the foundation everything else builds on.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lite/portal">Continue your setup</a></p>`;
  } else {
    // Brand DNA done but rev seg not done (SaaS only)
    subject = "Almost there — five quick questions left";
    body = `<p>Brand DNA is done — nice work. Five quick questions about your business and you're through to the product.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lite/portal/onboarding/segmentation">Finish setup</a></p>`;
  }

  await sendEmail({
    to: email,
    subject,
    body,
    classification: "transactional",
    purpose: `onboarding_nudge_${audience}_${nudgeIndex}`,
    tags: [
      { name: "type", value: "onboarding_nudge" },
      { name: "audience", value: audience },
    ],
  });

  void logActivity({
    companyId,
    contactId,
    kind: "onboarding_started",
    body: `Onboarding nudge #${nudgeIndex + 1} sent (${audience})`,
    meta: { nudgeIndex, audience },
  });

  // Self-re-enqueue for SaaS (escalating cadence: 24h → 72h → weekly)
  if (audience === "saas") {
    const nextIndex = nudgeIndex + 1;
    let delayHours: number;
    if (nextIndex === 1) {
      delayHours = await settingsRegistry.get("onboarding.saas_nudge_second_hours");
    } else {
      delayHours = await settingsRegistry.get("onboarding.saas_nudge_weekly_hours");
    }

    const nextRunAt = Date.now() + delayHours * 60 * 60 * 1000;
    await enqueueTask({
      task_type: "onboarding_nudge_email",
      runAt: nextRunAt,
      payload: {
        contactId,
        companyId,
        audience,
        nudgeIndex: nextIndex,
      },
      idempotencyKey: `onboarding_nudge_${contactId}_${nextIndex}`,
    });
  }
}

// ── practical_setup_reminder_email handler ─────────────────────────────

async function handlePracticalSetupReminder(task: ScheduledTaskRow): Promise<void> {
  if (!killSwitches.onboarding_nudges_enabled) return;

  const payload = parsePracticalSetup(task);
  if (!payload) return;

  const { contactId, companyId, reminderIndex } = payload;

  // Re-read state: which steps are still incomplete?
  const incomplete = getIncompletePracticalSteps(contactId);
  if (incomplete.length === 0) return; // all done — no-op

  const email = await getContactEmail(contactId);
  if (!email) return;

  // Per-step targeting: mention the incomplete steps specifically
  const stepNames = incomplete
    .map((k) => STEP_LABELS[k] ?? k)
    .join(", ");

  const subject = incomplete.length === 1
    ? `Quick one — ${stepNames}`
    : "A few quick things left";

  const body = incomplete.length === 1
    ? `<p>Quick one — we still need your ${stepNames}. Takes about 2 minutes.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lite/portal">Complete it here</a></p>`
    : `<p>A few practical bits left to sort: ${stepNames}. Each one takes about 2 minutes.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lite/portal">Complete them here</a></p>`;

  await sendEmail({
    to: email,
    subject,
    body,
    classification: "transactional",
    purpose: `practical_setup_reminder_${reminderIndex}`,
    tags: [
      { name: "type", value: "practical_setup_reminder" },
      { name: "steps_remaining", value: String(incomplete.length) },
    ],
  });

  void logActivity({
    companyId,
    contactId,
    kind: "onboarding_practical_setup_step_completed",
    body: `Practical setup reminder #${reminderIndex + 1} sent (${incomplete.length} steps remaining)`,
    meta: { reminderIndex, incompleteSteps: incomplete },
  });

  // Self-re-enqueue (escalating cadence: 24h → 72h → weekly)
  const nextIndex = reminderIndex + 1;
  let delayHours: number;
  if (nextIndex === 1) {
    delayHours = await settingsRegistry.get("onboarding.practical_nudge_second_hours");
  } else {
    delayHours = await settingsRegistry.get("onboarding.practical_nudge_weekly_hours");
  }

  const nextRunAt = Date.now() + delayHours * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "practical_setup_reminder_email",
    runAt: nextRunAt,
    payload: {
      contactId,
      companyId,
      reminderIndex: nextIndex,
    },
    idempotencyKey: `practical_setup_${contactId}_${nextIndex}`,
  });
}

// ── Export handler map ────────────────────────────────────────────────

export const ONBOARDING_NUDGE_HANDLERS: HandlerMap = {
  onboarding_nudge_email: handleOnboardingNudge,
  practical_setup_reminder_email: handlePracticalSetupReminder,
};
