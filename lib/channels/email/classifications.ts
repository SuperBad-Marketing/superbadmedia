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
  "six_week_plan_non_converter_expiry",
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
  // IF-2 — Trial shoot booking confirmations and reschedule notices.
  // Transactional: prospect already paid; these are operational.
  "shoot_booking_confirmed",
  "shoot_reschedule_confirmed",
  // IF-2 — Reflection-ready nudge. Non-transactional (marketing-adjacent).
  "reflection_ready",
  // IF-1 — Payment receipt (fires on payment_intent.succeeded).
  "trial_shoot_payment_receipt",
  // IF-3 — Abandon cadence emails.
  "intro_funnel_abandon_24h",
  "intro_funnel_abandon_3d",
  // IF-2 — Apology email for SuperBad-initiated cancel/reschedule.
  "apology_email",
  // TM-6 — Deliverable approval request + 48h reminder + outcome.
  // Approval request is transactional (client is in an active retainer
  // relationship and is being asked to sign off on work). Reminder
  // respects quiet window per spec.
  "deliverable_approval_request",
  "deliverable_approval_reminder",
  "deliverable_approval_outcome",
  // TM-7 — Morning task digest to Andy. Transactional: operational email
  // to the admin about his own tasks. Bypasses outreach kill switch + quiet
  // window so it reliably arrives at 08:00.
  "task_morning_digest",
  // SD-9 — Milestone spotter personal outreach. Admin-initiated to a contact
  // Andy has a relationship with. Not transactional; respects outreach kill
  // switch + quiet window.
  "milestone_outreach",
  // Rundown — resume link email sent after entry. Transactional: the prospect
  // just submitted their details and needs the link to continue.
  "rundown_resume",
  // Rundown — follow-up email after assessment completion with reveal re-access
  // link + Brand Pack download. Transactional: prospect just completed, these
  // are their deliverables.
  "rundown_followup",
  // Rundown — post-completion nurture sequence (3 emails over 10 days).
  // Non-transactional: marketing follow-up referencing Brand DNA findings.
  "rundown_sequence",
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
  "hiring_contractor_auth",
  "quote_send",
  "quote_reminder",
  "quote_expired",
  "invoice_send",
  "invoice_reminder",
  "invoice_supersede",
  "subscriber_login_link",
  "saas_payment_failed_lockout",
  "saas_data_loss_warning",
  "shoot_booking_confirmed",
  "shoot_reschedule_confirmed",
  "trial_shoot_payment_receipt",
  "apology_email",
  // SWP — plan delivery, revision replies, and expiry are all transactional
  // (prospect is in an engaged relationship — they paid for the trial shoot).
  "six_week_plan_delivery",
  "six_week_plan_revision_regenerated",
  "six_week_plan_revision_explained",
  "six_week_plan_expiry_email",
  "six_week_plan_non_converter_expiry",
  // TM-6 — approval request + outcome are transactional; reminder is not
  "deliverable_approval_request",
  "deliverable_approval_outcome",
  // TM-7 — task digest is operational admin email
  "task_morning_digest",
  // Rundown — resume link is transactional (prospect just submitted, needs link)
  "rundown_resume",
  // Rundown — follow-up is transactional (delivering the prospect's own artefacts)
  "rundown_followup",
] as const;

export function isTransactional(c: EmailClassification): boolean {
  return (TRANSACTIONAL_CLASSIFICATIONS as readonly string[]).includes(c);
}
