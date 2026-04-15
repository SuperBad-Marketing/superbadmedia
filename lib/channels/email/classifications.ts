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
  // BI-1 — Branded Invoicing emails. Invoices are engaged-conversation
  // transactional; bypass outreach kill switch + global quiet window.
  "invoice_send",
  "invoice_reminder",
  "invoice_supersede",
  // SB-6a — SaaS subscriber magic-link login. Transactional; subscriber
  // just paid, auth delivery bypasses outreach kill switch + quiet window.
  "subscriber_login_link",
  // SB-9 — SaaS past_due lockout + 7-day data-loss warning. Both
  // transactional: the subscriber is in an active billing relationship
  // and the email is recovery-critical.
  "saas_payment_failed_lockout",
  "saas_data_loss_warning",
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
  "invoice_send",
  "invoice_reminder",
  "invoice_supersede",
  "subscriber_login_link",
  "saas_payment_failed_lockout",
  "saas_data_loss_warning",
] as const;

export function isTransactional(c: EmailClassification): boolean {
  return (TRANSACTIONAL_CLASSIFICATIONS as readonly string[]).includes(c);
}
