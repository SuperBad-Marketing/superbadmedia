/**
 * Onboarding nudge scheduling — enqueue the initial nudge tasks.
 *
 * Two entry points:
 *   - `scheduleOnboardingNudges()` — enqueues the first non-start nudge
 *     at the configured delay. Called from the onboarding trigger (quote
 *     acceptance for retainer, Stripe payment for SaaS).
 *   - `schedulePracticalSetupReminders()` — enqueues the first practical
 *     setup reminder. Called when retainer onboarding completes Brand DNA
 *     and practical setup becomes the active section.
 *
 * Both are gated by the `onboarding_nudges_enabled` kill switch and use
 * idempotency keys to prevent double-scheduling.
 *
 * Spec: onboarding-and-segmentation.md §7.3, §7.4.
 * Owner: OS-3.
 */
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { killSwitches } from "@/lib/kill-switches";
import settingsRegistry from "@/lib/settings";

export interface ScheduleOnboardingNudgesInput {
  contactId: string;
  companyId: string;
  audience: "retainer" | "saas";
}

/**
 * Enqueue the first onboarding non-start nudge email.
 *
 * Retainer: single nudge at 24h, then cockpit flag for Andy.
 * SaaS: escalating 24h → 72h → weekly chain (self-re-enqueuing).
 *
 * Kill-switch-gated. Idempotent via `onboarding_nudge_{contactId}_0`.
 */
export async function scheduleOnboardingNudges(
  input: ScheduleOnboardingNudgesInput,
): Promise<void> {
  if (!killSwitches.onboarding_nudges_enabled) return;

  const { contactId, companyId, audience } = input;

  const delayHours =
    audience === "retainer"
      ? await settingsRegistry.get("onboarding.retainer_non_start_nudge_hours")
      : await settingsRegistry.get("onboarding.saas_nudge_first_hours");

  const runAt = Date.now() + delayHours * 60 * 60 * 1000;

  await enqueueTask({
    task_type: "onboarding_nudge_email",
    runAt,
    payload: { contactId, companyId, audience, nudgeIndex: 0 },
    idempotencyKey: `onboarding_nudge_${contactId}_0`,
  });
}

export interface SchedulePracticalSetupRemindersInput {
  contactId: string;
  companyId: string;
}

/**
 * Enqueue the first practical setup reminder (retainer-only).
 *
 * Escalating 24h → 72h → weekly chain (self-re-enqueuing in the handler).
 *
 * Kill-switch-gated. Idempotent via `practical_setup_{contactId}_0`.
 */
export async function schedulePracticalSetupReminders(
  input: SchedulePracticalSetupRemindersInput,
): Promise<void> {
  if (!killSwitches.onboarding_nudges_enabled) return;

  const { contactId, companyId } = input;

  const delayHours = await settingsRegistry.get(
    "onboarding.practical_nudge_first_hours",
  );

  const runAt = Date.now() + delayHours * 60 * 60 * 1000;

  await enqueueTask({
    task_type: "practical_setup_reminder_email",
    runAt,
    payload: { contactId, companyId, reminderIndex: 0 },
    idempotencyKey: `practical_setup_${contactId}_0`,
  });
}
