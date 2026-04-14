/**
 * Email classification enum — the full Phase 3.5 set (16 values).
 *
 * Used by:
 *   - `sendEmail()` to gate on `outreach_send_enabled` kill switch
 *   - `canSendTo()` for suppression scope (classification-specific vs global)
 *   - `external_call_log` job field
 *   - Spam Act / DMARC compliance routing
 *
 * Transactional = exempt from quiet window + outreach kill switch.
 * All others require `outreach_send_enabled = true` and pass quiet-window
 * and suppression checks.
 *
 * Per BUILD_PLAN.md A7 (verbatim set).
 */
export const EMAIL_CLASSIFICATIONS = [
  "transactional",
  "outreach",
  "portal_magic_link_recovery",
  "deliverables_ready_announcement",
  "six_week_plan_invite",
  "six_week_plan_followup",
  "six_week_plan_delivery",
  "six_week_plan_revision_regenerated",
  "six_week_plan_revision_explained",
  "six_week_plan_expiry_email",
  "hiring_invite",
  "hiring_followup_question",
  "hiring_trial_send",
  "hiring_archive_notice",
  "hiring_contractor_auth",
  "hiring_bench_assignment",
  // QB-3 — quote send is admin-initiated to a recipient who explicitly
  // engaged a sales conversation, so it bypasses the outreach kill switch
  // and the global quiet window. Reminder + expiry land at QB-6.
  "quote_send",
  // QB-6 — 3-day unread reminder + expiry notice. Both transactional by
  // the same engaged-conversation reasoning as quote_send; separate keys
  // keep per-classification suppression granularity.
  "quote_reminder",
  "quote_expired",
] as const;

export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];

/**
 * Classifications that bypass the outreach kill switch and quiet window.
 * These are operational emails (auth, delivery confirmations) that must
 * reach the recipient regardless of outreach state.
 */
export const TRANSACTIONAL_CLASSIFICATIONS: readonly EmailClassification[] = [
  "transactional",
  "portal_magic_link_recovery",
  "quote_send",
  "quote_reminder",
  "quote_expired",
] as const;

export function isTransactional(c: EmailClassification): boolean {
  return (TRANSACTIONAL_CLASSIFICATIONS as readonly string[]).includes(c);
}
