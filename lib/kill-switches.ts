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
  | "setup_wizards_enabled"
  | "wizards_nudges_enabled"
  | "invoicing_manual_cycle_enqueue_enabled"
  | "saas_usage_enforcement_enabled"
  | "saas_tier_change_enabled"
  | "saas_payment_recovery_enabled"
  | "saas_headlines_enabled"
  | "saas_cancel_flow_enabled";

type KillSwitchRegistry = Record<KillSwitchKey, boolean>;

const defaults: KillSwitchRegistry = {
  outreach_send_enabled: false,
  scheduled_tasks_enabled: false,
  llm_calls_enabled: false,
  drift_check_enabled: false,
  sentry_enabled: false,
  brand_dna_assessment_enabled: false,
  setup_wizards_enabled: false,
  wizards_nudges_enabled: false,
  // QB-6: gate for `manual_invoice_generate` enqueue in
  // `lib/quote-builder/accept.ts`. Flipped ON 2026-04-15 at end of BI-1b
  // once the invoice pipeline (BI-1a schema + primitives + handlers) and
  // the token-gated PDF + public read-only view (BI-1b) were all green.
  // Admin compose/edit + Stripe Payment Element land in BI-2; they do
  // not depend on this flag.
  invoicing_manual_cycle_enqueue_enabled: true,
  // SB-7: when false, `checkUsageLimit()` returns `allowed: true`
  // unconditionally (caps surface on the sticky bar but do not block
  // actions). Flipped ON in Phase 6 once the first product goes live
  // under real traffic.
  saas_usage_enforcement_enabled: false,
  // SB-8: gates the tier-change + product-switch mutation paths. Flip OFF
  // via runtime override if Stripe Subscription update calls start
  // misbehaving; defaults ON because the feature is the primary path off
  // the at-cap upgrade CTA.
  saas_tier_change_enabled: true,
  // SB-9: gates the branded past_due recovery path (inline SetupIntent
  // card update on the onboarding dashboard). Off = dashboard falls back
  // to the SB-6b Stripe Billing Portal link; counter increment + 7-day
  // data-loss warning scheduling still run (safe side-effects).
  saas_payment_recovery_enabled: true,
  // SB-10: gates the admin cockpit SaaS headlines strip + the
  // `getSaasHealthBanners()` emission. When OFF, admin surfaces fall back
  // to a zero-state eyebrow ("Headlines paused") and the Daily Cockpit
  // banner source returns `[]`. The primitive query itself is NOT gated —
  // debug routes and future cost observability can still read numbers
  // while the public strip is hidden.
  saas_headlines_enabled: true,
  // SB-11: gates the `/lite/portal/subscription` cancel surface. When OFF,
  // the route 404s (with a bartender-stub "Talk to us" link); the Stripe
  // cancel primitive itself is NOT gated, so an admin-driven cancel path
  // (future) can still run while the subscriber-facing surface is paused
  // — matches SB-10's surface-vs-primitive gating pattern.
  saas_cancel_flow_enabled: true,
};

// Runtime overrides sit in a writable proxy so tests and Phase 6 launch
// ops can flip a switch without a rebuild. Production enablement comes
// from a follow-up migration that writes into `settings` — B1 owns the
// runtime-wired path.
//
// `KILL_SWITCHES_ON` (SW-5c): comma-separated list of switch keys to flip
// on at process boot. Intended for the Playwright webServer + future dev
// workflows that need a subset of switches enabled without rebuilding.
// Unknown keys are ignored. Never set in production until B1's DB-backed
// path lands — this is a stop-gap for out-of-process enablement only.
const envOverride = process.env.KILL_SWITCHES_ON;
const enabled = new Set<string>(
  envOverride
    ? envOverride
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : [],
);

export const killSwitches: KillSwitchRegistry = Object.fromEntries(
  (Object.keys(defaults) as KillSwitchKey[]).map((k) => [
    k,
    enabled.has(k) ? true : defaults[k],
  ]),
) as KillSwitchRegistry;

export function resetKillSwitchesToDefaults(): void {
  for (const key of Object.keys(defaults) as KillSwitchKey[]) {
    killSwitches[key] = defaults[key];
  }
}

export const KILL_SWITCH_KEYS = Object.keys(defaults) as KillSwitchKey[];
