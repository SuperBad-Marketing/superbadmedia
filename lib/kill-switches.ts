/**
 * Central kill-switches. Anything that can spend money, send email, or
 * hit an external API autonomously must be gated by one of these flags.
 *
 * All switches ship **disabled** at v1.0. Enabled explicitly by a
 * follow-up PATCH or by Andy during Phase 6 launch.
 *
 * Per AUTONOMY_PROTOCOL.md §2 "Kill-switches as the safety net".
 *
 * Usage:
 *   import { killSwitches } from "@/lib/kill-switches"
 *   if (!killSwitches.outreach_send_enabled) return { skipped: true }
 */

export type KillSwitchKey =
  | "outreach_send_enabled"
  | "scheduled_tasks_enabled"
  | "llm_calls_enabled"
  | "drift_check_enabled"
  | "sentry_enabled"
  | "brand_dna_assessment_enabled"
  | "setup_wizards_enabled";

type KillSwitchRegistry = Record<KillSwitchKey, boolean>;

const defaults: KillSwitchRegistry = {
  outreach_send_enabled: false,
  scheduled_tasks_enabled: false,
  llm_calls_enabled: false,
  drift_check_enabled: false,
  sentry_enabled: false,
  brand_dna_assessment_enabled: false,
  setup_wizards_enabled: false,
};

// Runtime overrides sit in a writable proxy so tests and Phase 6 launch
// ops can flip a switch without a rebuild. Production enablement comes
// from a follow-up migration that writes into `settings` — B1 owns the
// runtime-wired path.
export const killSwitches: KillSwitchRegistry = { ...defaults };

export function resetKillSwitchesToDefaults(): void {
  for (const key of Object.keys(defaults) as KillSwitchKey[]) {
    killSwitches[key] = defaults[key];
  }
}

export const KILL_SWITCH_KEYS = Object.keys(defaults) as KillSwitchKey[];
