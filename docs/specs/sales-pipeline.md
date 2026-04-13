# Sales Pipeline — Feature Spec

**Phase:** 3 (Feature Specs)
**Status:** Locked 2026-04-11
**Depends on:** `FOUNDATIONS.md`, `docs/specs/design-system-baseline.md`, `SCOPE.md § Sales pipeline`
**Related future specs:** Branded Invoicing, Intro Funnel, Lead Generation, Quote Builder, Client Management, Unified Inbox, Daily Cockpit, SaaS Subscription Billing, Hiring Pipeline

---

## 1. Purpose

The Sales Pipeline is the spine of SuperBad Lite. Every other feature plugs into it:

- **Lead Generation** drops new cards into the `Lead` stage.
- **Intro Funnel** drops paid trial-shoot bookings into the `Trial Shoot` stage.
- **Unified Inbox** advances stages on inbound replies.
- **Quote Builder** lands deals into `Quoted` and (on payment) into `Won`.
- **Client Management** picks up `Won` deals and graduates them into client records.
- **Daily Cockpit** reads pipeline state for the morning brief.
- **SaaS Subscription Billing** receives `Won` deals tagged `won_outcome = 'saas'`.

The pipeline is a Kanban board with one card per **Deal**, ordered by stage. Stages mostly auto-advance from system events (outbound email, inbound reply, Stripe payment). Manual drag-and-drop is always available as an override. The pipeline is the single source of truth for "where is this opportunity right now".

---

## 2. User story

> Andy opens SuperBad Lite in the morning. The Cockpit tells him three deals went stale overnight. He clicks through to the Sales Pipeline. The board shows 8 columns: Lead, Contacted, Conversation, Trial Shoot, Quoted, Negotiating, Won, Lost. Each column has cards. Cards in the right-most active stages (Quoted, Negotiating) glow slightly warmer. Three cards have a soft amber halo — those are the stale ones. He hovers one. The card expands in place to show the next-best action ("nudge — last contact 9 days ago"), the deal value, and the primary contact's name. He clicks "send nudge". The system generates a draft outreach email using the Lead Generation pipeline, shows it to him for approval, and sends it. The card auto-advances back to "fresh", and a new activity log entry appears on the Deal feed.
>
> Later, Stripe fires a `checkout.session.completed` webhook for one of his Quoted deals. The card animates from `Quoted` to `Won` with the house spring, the `won_outcome` is set to `retainer` from the quote metadata, the cockpit increments its "Won this week" counter, and the Client Management subsystem provisions a fresh client record. Andy did nothing — the system did it for him.

---

## 3. Stage model

### 3.1 The 8 stages

| # | Stage | What it means | Typical entry | Typical exit |
|---|---|---|---|---|
| 1 | **Lead** | A prospect we've identified but haven't contacted yet. | Lead Generation creates the card. | Outbound email sent → `Contacted` |
| 2 | **Contacted** | We've sent at least one outbound message. No reply yet. | Auto from outbound send. | Inbound reply matched → `Conversation` |
| 3 | **Conversation** | They replied. A real exchange is happening. | Auto from inbound reply OR manual "they replied" button. | Trial shoot booked → `Trial Shoot` OR direct quote → `Quoted` |
| 4 | **Trial Shoot** | They've paid for the introductory shoot ($297, will increase). This is the dominant path to retainer. | Auto from Intro Funnel (trial shoot purchased). | Feedback questionnaire returned + quote sent → `Quoted` |
| 5 | **Quoted** | A formal quote is in their hands. Awaiting decision. | Auto from Quote Builder send. | Stripe payment → `Won`, OR manual drag if they push back → `Negotiating` |
| 6 | **Negotiating** | They've pushed back on the quote. Revising. | Manual drag from `Quoted`. | New quote sent → back to `Quoted`, OR Stripe payment → `Won` |
| 7 | **Won** | They paid. The deal closed. | Auto from Stripe webhook OR manual drag (only if `Company.billing_mode = 'manual'`). | Terminal — graduates to Client Management. |
| 8 | **Lost** | Dead deal. | Manual drag only — never auto. | Terminal. |

**Total: 8 stages.** This is a closed list. Adding a stage requires explicit Andy approval and updates here, in `SCOPE.md`, and in every cross-spec that touches the stage model.

> **SCOPE.md alignment note:** `SCOPE.md` originally specified 7 stages with paid intro offer landing in `Conversation`. This spec supersedes that — `Trial Shoot` is now its own stage (Q12 brainstorm reframing on 2026-04-11) because the trial shoot is the *default* path for nearly all retainer leads, not an alternative ingress.

### 3.2 Auto-transition rules

| Trigger | From | To | Source |
|---|---|---|---|
| Outbound email sent (first send to this Deal) | `Lead` | `Contacted` | Resend send event |
| Inbound email matched to existing Deal | `Contacted` | `Conversation` | Resend inbound webhook |
| Trial shoot purchase via Intro Funnel | `Conversation` (or `Lead`/`Contacted` if skipped) | `Trial Shoot` | Stripe `checkout.session.completed` (intro product) |
| Quote sent via Quote Builder | `Conversation` / `Trial Shoot` | `Quoted` | Quote Builder action |
| Stripe payment for retainer/SaaS quote | `Quoted` / `Negotiating` | `Won` | Stripe `checkout.session.completed` (retainer or SaaS product) |

**One-way enforcement:** auto-transitions only ever move *forward*. A Stripe webhook never moves a deal backward. Backward movement is always either (a) a manual drag, or (b) a bounce/complaint rollback (see §3.4).

### 3.3 Manual transitions

- **Manual drag is always allowed** — Andy can drag any card to any stage at any time. This is the override valve.
- **Won is protected.** Dragging a card *into* `Won` from `Lead`, `Contacted`, or `Conversation` triggers a `DestructiveConfirmModal` (see §7.3) requiring Andy to type the company name. **Exception:** if `Company.billing_mode = 'manual'` (see §6.1), the modal is a simple confirm — no typing required. This protects against fat-finger Wons on Stripe-billed companies (where Won should always be webhook-driven).
- **Dragging a card *out* of Won** is treated as a destructive action and always requires typing the company name, regardless of `billing_mode`.
- **Lost is always manual.** Nothing in the system will auto-mark a deal Lost. Dragging into Lost triggers the Loss Reason modal (§3.5).

### 3.4 Bounce / complaint rollback

Resend webhooks can fire after an outbound send:

| Resend event | Action |
|---|---|
| `email.bounced` (hard bounce, e.g. unknown recipient) | Mark `Contact.email_status = 'invalid'`. **Roll the Deal back from `Contacted` → `Lead` ONLY IF the Deal is still in `Contacted` and no other valid send has happened since.** Open a multi-contact picker UI: "this contact bounced, pick another contact on this Company to retry, or mark Company as no-go." |
| `email.bounced` (soft bounce, e.g. mailbox full) | No rollback. Mark `Contact.email_status = 'soft_bounce'` for visibility. Retry once after 24h. |
| `email.complained` (spam complaint) | Mark `Contact.email_status = 'complained'`. **Mark `Company.do_not_contact = true`.** Roll the Deal back to `Lead` and freeze it (cannot be dragged forward without un-freezing on the Company). Fire an urgent toast/sound — this is a brand reputation event. |

**Rollback safety rule:** the rollback only fires if the Deal hasn't moved past the auto-advanced stage. If Andy already manually advanced the Deal further, the bounce just flags the contact, no rollback. This prevents the bounce-handler from undoing work.

### 3.5 Loss Reason modal

Dragging a card into `Lost` opens a modal with a closed list of 7 reasons:

1. Price
2. Timing
3. Went with someone else
4. Not a fit
5. Ghosted
6. Internal change
7. Other (free-text required)

`loss_reason` and `loss_notes` are stored on the Deal. These power loss-pattern analytics in the Cockpit.

---

## 4. Data model (Drizzle schema)

### 4.1 New tables

> **Consolidated `activity_log.kind` enum** — this is the authoritative location for every `activity_log.kind` value across the platform. Each downstream spec that declares `activity_log.kind` additions in its own prose (e.g. Quote Builder §5.7, Branded Invoicing §5.3, Intro Funnel §12, Unified Inbox §6, Six-Week Plan §7, etc.) is a **declarer**; the enum definition below is the **single receiver**. Phase 5 foundation migration seeds this union. If a new spec adds a value, patch this enum in the same session.

```ts
// companies — the top-level CRM entity
export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  industry: text('industry'),
  size_band: text('size_band'), // small | medium | large
  billing_mode: text('billing_mode', { enum: ['stripe', 'manual'] }).notNull().default('stripe'),
  do_not_contact: integer('do_not_contact', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  trial_shoot_status: text('trial_shoot_status', {
    enum: ['none', 'booked', 'planned', 'in_progress', 'completed_awaiting_feedback', 'completed_feedback_provided'],
  }).notNull().default('none'),
  trial_shoot_completed_at: integer('trial_shoot_completed_at', { mode: 'timestamp' }),
  trial_shoot_plan: text('trial_shoot_plan'), // free-form plan/brief
  trial_shoot_feedback: text('trial_shoot_feedback'), // questionnaire JSON or text
  // Business-structure shape — canonical source across the platform (added 2026-04-13 Phase 3.5 Step 11 F1.b).
  // Downstream consumers (Brand DNA §8.1, Six-Week Plan §4, retainer-fit §13.4, Onboarding, Cockpit brief)
  // all read from this column. Nullable: companies minted before shape was captured (e.g. legacy leads) stay null.
  // Intro Funnel + Brand DNA keep their own `shape` columns as historical snapshots, NOT sources of truth.
  // Mutations write an `activity_log.kind = 'company_shape_updated'` row and mark downstream artefacts stale.
  shape: text('shape', {
    enum: ['solo_founder', 'founder_led_team', 'multi_stakeholder_company'],
  }),
  first_seen_at: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// contacts — individual humans, attached to a Company
export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey(),
  company_id: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'), // "Marketing Director", "Founder", etc.
  email: text('email'),
  email_status: text('email_status', {
    enum: ['unknown', 'valid', 'soft_bounce', 'invalid', 'complained'],
  }).notNull().default('unknown'),
  phone: text('phone'),
  is_primary: integer('is_primary', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  // Stripe identity — canonical. Created lazily on first payment via FOUNDATIONS §11.7 `ensureStripeCustomer(contactId)`.
  // Same contact across multiple deals (trial shoot + retainer + SaaS) shares one Stripe Customer.
  // `deals.stripe_customer_id` (§12 state machine) is a denormalised mirror for subscription-path reads.
  stripe_customer_id: text('stripe_customer_id').unique(),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// deals — opportunities, attached to a Company and (optionally) a primary Contact
export const deals = sqliteTable('deals', {
  id: text('id').primaryKey(),
  company_id: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  primary_contact_id: text('primary_contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  title: text('title').notNull(), // human label, e.g. "Q2 retainer", "trial shoot intro"
  stage: text('stage', {
    enum: ['lead', 'contacted', 'conversation', 'trial_shoot', 'quoted', 'negotiating', 'won', 'lost'],
  }).notNull().default('lead'),
  value_cents: integer('value_cents'),                       // optional from any stage
  value_estimated: integer('value_estimated', { mode: 'boolean' }).notNull().default(true),
  won_outcome: text('won_outcome', { enum: ['retainer', 'saas', 'project'] }), // required when stage='won'. 'project' added per Quote Builder §5.6 cross-spec flag (one-off project work that settles without a subscription).
  loss_reason: text('loss_reason', {
    enum: ['price', 'timing', 'went_with_someone_else', 'not_a_fit', 'ghosted', 'internal_change', 'other'],
  }),
  loss_notes: text('loss_notes'),
  next_action_text: text('next_action_text'),                // null = auto-derived from stage rules
  next_action_overridden_at: integer('next_action_overridden_at', { mode: 'timestamp' }), // null = not overridden
  snoozed_until: integer('snoozed_until', { mode: 'timestamp' }), // staleness suppression
  last_stage_change_at: integer('last_stage_change_at', { mode: 'timestamp' }).notNull(),
  source: text('source'), // 'lead_gen' | 'intro_funnel' | 'manual' | etc.
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// activity log — one row per event, three nullable FKs for query scoping
export const activity_log = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  company_id: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  contact_id: text('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  deal_id: text('deal_id').references(() => deals.id, { onDelete: 'cascade' }),
  kind: text('kind', {
    enum: [
      // --- Sales Pipeline (original, 2026-04-11) ---
      'note',                       // manual note added by Andy
      'stage_change',               // any stage transition
      'email_sent',                 // outbound
      'email_received',             // inbound
      'email_bounced',
      'email_complained',
      'quote_sent',
      'payment_received',
      'trial_shoot_booked',
      'trial_shoot_completed',
      'feedback_received',
      // --- Cross-spec extensions (consolidated 2026-04-13 Phase 3.5) ---
      // Each block owned by the originating spec. Phase 5 foundation migration seeds the full union.
      // Cost & Usage Observatory (10):
      'cost_anomaly_fired', 'cost_anomaly_acknowledged', 'cost_anomaly_resolved',
      'kill_switch_triggered', 'kill_switch_released', 'band_adjusted',
      'monthly_threshold_crossed', 'projection_threshold_crossed',
      'cost_attribution_transferred', 'observatory_settings_changed',
      // Finance Dashboard (8, added 2026-04-13):
      'finance_expense_created', 'finance_expense_updated', 'finance_expense_confirmed',
      'finance_recurring_booked', 'finance_recurring_created', 'finance_recurring_paused',
      'finance_export_generated', 'finance_bas_filed',
      // Hiring Pipeline (16, added 2026-04-13):
      'candidate_sourced', 'candidate_invited', 'candidate_applied', 'candidate_followup_received',
      'candidate_screened', 'candidate_trial_sent', 'candidate_trial_delivered', 'candidate_trial_reviewed',
      'candidate_benched', 'candidate_paused', 'candidate_resumed', 'candidate_archived',
      'candidate_unarchived', 'role_brief_opened', 'role_brief_regenerated', 'role_brief_closed',
      // Client Context Engine — active_strategy artefact (4, added 2026-04-13 Phase 3.5 step 2):
      'active_strategy_created', 'active_strategy_reviewed',
      'active_strategy_updated', 'active_strategy_archived',
      // --- Consolidated 2026-04-13 Phase 3.5 step 2a (spec self-containment pass) ---
      // Each block owned by the originating spec; values are additive, non-breaking.
      // Quote Builder (17 — `quote_sent` already above in original block):
      'quote_draft_started', 'quote_viewed', 'quote_accepted', 'quote_settled',
      'quote_superseded', 'quote_expired', 'quote_withdrawn',
      'scheduled_task_dispatched',
      'subscription_cancel_intercepted_preterm',
      'subscription_early_cancel_paid_remainder',
      'subscription_early_cancel_buyout_50pct',
      'subscription_paused', 'subscription_pause_ended',
      'subscription_upgrade_intent', 'subscription_downgrade_intent',
      'subscription_cancelled_post_term', 'subscription_ended_gracefully',
      // Branded Invoicing (8):
      'invoice_generated', 'invoice_sent', 'invoice_overdue',
      'invoice_reminder_sent', 'invoice_marked_paid', 'invoice_paid_online',
      'invoice_superseded', 'invoice_voided',
      // Brand DNA Assessment (8):
      'assessment_started', 'section_completed', 'assessment_completed',
      'profile_generated', 'blend_generated',
      'invite_created', 'invite_used', 'retake_started',
      // Intro Funnel (21 — `trial_shoot_booked` / `trial_shoot_completed` already above in original block;
      //   Intro Funnel's `shoot_*` values are a distinct naming family for the portal-side shoot lifecycle
      //   and are intentionally preserved alongside the original `trial_shoot_*` values):
      'intro_funnel_started', 'intro_funnel_section_completed',
      'intro_funnel_abandoned', 'intro_funnel_paid',
      'intro_funnel_sms_sent', 'intro_funnel_sms_delivered', 'intro_funnel_sms_replied',
      'intro_funnel_cancelled_refunded', 'intro_funnel_cancelled_no_refund',
      'intro_funnel_no_show',
      'shoot_booked', 'shoot_rescheduled', 'shoot_cancelled',
      'shoot_cancelled_by_superbad', 'shoot_rescheduled_by_superbad',
      'shoot_reschedule_limit_hit',
      'deliverables_ready', 'deliverables_viewed',
      'post_trial_negative_feedback', 'retainer_fit_recommendation_ready',
      'reflection_complete',
      // Lead Generation (10):
      'outreach_sent', 'outreach_opened', 'outreach_clicked',
      'outreach_replied', 'outreach_bounced', 'outreach_unsubscribed',
      'sequence_stopped_engagement', 'sequence_stopped_manual',
      'autonomy_graduated', 'autonomy_demoted',
      // Content Engine (15):
      'content_topic_researched', 'content_topic_vetoed',
      'content_draft_generated', 'content_draft_approved', 'content_draft_rejected',
      'content_post_published',
      'content_newsletter_scheduled', 'content_newsletter_sent',
      'content_social_draft_generated', 'content_social_published',
      'content_subscriber_added', 'content_subscriber_removed',
      'content_outreach_matched',
      'content_seed_keyword_added', 'content_seed_keyword_removed',
      // Client Context Engine — non-active_strategy (11):
      'context_summary_regenerated',
      'action_item_extracted', 'action_item_manual_created',
      'action_item_completed', 'action_item_dismissed', 'action_item_edited',
      'draft_generated', 'draft_nudged', 'draft_sent',
      'draft_discarded', 'draft_channel_switched',
      // Client Management (8):
      'portal_chat_message_sent', 'portal_chat_escalated', 'portal_chat_action_taken',
      'data_export_requested', 'data_export_completed',
      'external_link_added', 'external_link_removed',
      'client_profile_viewed_by_admin',
      // Daily Cockpit (8):
      'cockpit_brief_generated', 'cockpit_brief_regenerated',
      'cockpit_brief_skipped_quiet',
      'cockpit_waiting_opened', 'cockpit_health_opened',
      'cockpit_chip_tapped', 'cockpit_banner_dismissed',
      'cockpit_slot_rolled_over',
      // Onboarding + Segmentation (8):
      'onboarding_started', 'onboarding_welcome_email_sent',
      'onboarding_brand_dna_started', 'onboarding_revenue_seg_completed',
      'onboarding_product_config_completed',
      'onboarding_practical_setup_step_completed',
      'onboarding_credentials_created', 'onboarding_completed',
      // SaaS Subscription Billing (11):
      'saas_product_created', 'saas_product_published', 'saas_product_archived',
      'saas_subscription_created', 'saas_subscription_upgraded',
      'saas_subscription_downgraded', 'saas_subscription_product_switched',
      'saas_payment_failed_lockout', 'saas_payment_recovered',
      'saas_data_loss_warning_sent', 'saas_usage_limit_reached',
      // Setup Wizards (6):
      'wizard_started', 'wizard_step_completed', 'wizard_completed',
      'wizard_abandoned', 'wizard_resumed', 'integration_registered',
      // Unified Inbox (18):
      'inbox_thread_created', 'inbox_message_received', 'inbox_message_sent',
      'inbox_routed', 'inbox_routed_reviewed',
      'inbox_notification_fired', 'inbox_notification_corrected',
      'inbox_draft_generated', 'inbox_draft_refined',
      'inbox_draft_sent', 'inbox_draft_discarded',
      'inbox_hygiene_purged', 'inbox_noise_promoted', 'inbox_keep_pinned',
      'inbox_import_completed', 'inbox_import_backfilled',
      'inbox_ticket_status_changed', 'inbox_thread_merged',
      // Six-Week Plan Generator (17):
      'six_week_plan_generation_started',
      'six_week_plan_strategy_ready_for_review',
      'six_week_plan_strategy_approved', 'six_week_plan_strategy_regenerated',
      'six_week_plan_detail_ready_for_review',
      'six_week_plan_approved', 'six_week_plan_released',
      'six_week_plan_self_activated',
      'six_week_plan_revision_requested', 'six_week_plan_revision_regenerated',
      'six_week_plan_revision_explained',
      'six_week_plan_superseded_by_revision',
      'six_week_plan_migrated_to_client_context',
      'six_week_plan_refresh_review_requested',
      'six_week_plan_live_strategy_set',
      'six_week_plan_portal_archived_non_converter',
      'six_week_plan_pdf_downloaded',
      // Shape canonicalisation (2, added 2026-04-13 Phase 3.5 Step 11 F1.b):
      'company_shape_updated', 'shape_mismatch_flagged',
    ],
  }).notNull(),
  body: text('body').notNull(),     // human-readable summary
  meta: text('meta', { mode: 'json' }), // structured payload (from_stage, to_stage, amount, etc.)
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  created_by: text('created_by'),   // null = system, otherwise user_id
})

// webhook_events — idempotency table for Stripe + Resend
export const webhook_events = sqliteTable('webhook_events', {
  id: text('id').primaryKey(),       // event ID from the provider
  provider: text('provider', { enum: ['stripe', 'resend'] }).notNull(),
  event_type: text('event_type').notNull(),
  payload: text('payload', { mode: 'json' }).notNull(),
  processed_at: integer('processed_at', { mode: 'timestamp' }).notNull(),
  result: text('result', { enum: ['ok', 'error', 'skipped'] }).notNull(),
  error: text('error'),
})
```

### 4.1A Shape editing surface + staleness cascade (added 2026-04-13 Phase 3.5 Step 11 F1.b)

**Admin surface.** Company profile (rendered by Client Management on `/lite/companies/[id]`) exposes a **Shape** dropdown with the three enum values (`solo_founder` / `founder_led_team` / `multi_stakeholder_company`) plus a `—` option for null. Andy-only. Every change:

1. Writes `activity_log.kind = 'company_shape_updated'` with `meta: { old, new, reason?: string }`.
2. Fires a **staleness cascade** across downstream artefacts tied to the company:
   - `brand_dna_profiles.needs_regeneration = true` on the current profile (where `is_current = true`). Surfaces a "shape changed — retake recommended" banner; next Brand DNA regeneration clears the flag.
   - `active_strategy` (Client Context Engine) → mark stale via Context Engine's staleness mechanism. Next read regenerates.
   - `intro_funnel_retainer_fit` → if `acted_on = false`, mark stale; cockpit card surfaces a warning chip "shape changed since this was generated".
   - Cockpit brief → no retroactive patch; next `maybeRegenerateBrief()` reads new shape.
   - Six-Week Plan → if pre-conversion and not yet approved, mark stale via plan's regeneration flag (see Six-Week Plan §4). If post-conversion, cascade flows via `active_strategy`.
3. **No eager regeneration.** Artefacts are marked stale; they regenerate lazily on next access. Prevents Opus-call stampedes and lets Andy undo an accidental change without immediate cost.

**Source-of-truth discipline.** Every downstream consumer reads `companies.shape` first, falling back to `intro_funnel_submissions.shape` only if canonical is null. No downstream reads `brand_dna_profiles.shape` as a source of truth — that column is a historical snapshot only.

### 4.2 Validation rules (enforced in `validateDeal()` before every write)

1. `stage = 'won'` ⇒ `won_outcome` is non-null.
2. `stage = 'lost'` ⇒ `loss_reason` is non-null. If `loss_reason = 'other'`, `loss_notes` is non-null.
3. `value_cents` may be null in any stage except `won` (where Stripe will populate it).
4. `value_estimated = false` only when populated by Quote Builder or Stripe webhook.
5. `next_action_overridden_at` resets to null on every stage change (manual override is per-stage).
6. `last_stage_change_at` updates on every stage change (used by stale-deal detection §8).

### 4.3 Activity feed query patterns

Three feeds, one table:

```ts
// Deal feed — only events for this Deal
SELECT * FROM activity_log WHERE deal_id = ? ORDER BY created_at DESC;

// Contact feed — all events for this Contact across all Deals
SELECT * FROM activity_log WHERE contact_id = ? ORDER BY created_at DESC;

// Company feed — all events for this Company across all Contacts and Deals
SELECT * FROM activity_log WHERE company_id = ? ORDER BY created_at DESC;
```

**Rule:** Company-level notes (`deal_id IS NULL AND contact_id IS NULL`) appear only on the Company feed, NOT on individual Deal feeds. This keeps Deal feeds deal-scoped.

---

## 5. UI

### 5.1 Shell + density

- Lives inside `AdminShell` (locked in design system baseline §3).
- Page-level density: `density-comfort` (admin work surface).
- Single-pane full-bleed Kanban — no secondary sidebar on this page. The Deal detail opens as a slide-over panel (`SheetWithSound` primitive — see §7.2), not a separate route.

### 5.2 Kanban board

Built on the `KanbanBoard` custom Lite primitive (locked in design system baseline). DnD library: **dnd-kit** (accessible, React 19 compatible, works with Framer Motion drop animations).

**Layout:**
- 8 columns, horizontally scrollable on screens narrower than ~1600px.
- Column header: stage name (DM Sans semibold, label size), card count (mono), and a subtle warm tint background tied to a step on the extended warm-neutral scale (Lead = lightest, Won = warmest, Lost = desaturated grey).
- Cards use the graduated soft radius `--radius-default` (8px).
- Drop animation: house spring (`mass:1, stiffness:220, damping:25`).

**Empty column:** uses the locked `EmptyState` primitive with one of the empty-state copy entries (e.g. `Lead` empty: *"No leads yet. Lead Gen will fill this in when it's built."*).

### 5.3 Card content (two-tier, Q8 lock)

**Compact view (always visible) — 5 elements:**
1. Company name (DM Sans semibold, headline-sm)
2. Deal title (DM Sans regular, body-sm, 1 line, truncate)
3. Deal value (mono, body-sm) — prefixed with `est.` if `value_estimated = true`, prefixed with `$` and bold if not
4. Next action label (italic narrative face, caption) — auto-derived or manual override
5. Stale halo if applicable (see §8)

**Hover-expanded overlay (desktop only, 300ms hover-intent delay) — adds 3 elements:**
6. Primary contact name + role
7. Last activity timestamp ("9 days ago")
8. Quick actions row: `Send nudge` / `Open detail` / `Snooze`

**Mobile:** the hover-expanded overlay is excluded. Tapping a card opens the Deal detail slide-over directly.

**Motion:** Tier 1 only — house spring fade-in/fade-out on hover. NOT a Tier 2 cinematic moment. (This protects the Tier 2 closed-list discipline.)

### 5.4 Won-card flavour

`Won` cards display a small badge in the top-right corner:
- **`RETAINER`** — pink background (`--brand-pink`), cream text. Pink is justified here because Won deals are customer-warmth events.
- **`SAAS`** — orange background (`--brand-orange`), charcoal text.

Badge uses Black Han Sans at caption size — this is one of the 8 locked BHS locations from the design system baseline (spec update needed there).

### 5.5 Drag interactions

- **Standard drag:** house spring, card lifts +4px with shadow, drop is a soft settle.
- **Drag into Won (Stripe-billed company):** opens `DestructiveConfirmModal` requiring company-name typing.
- **Drag into Won (manual-billed company):** opens a simple confirm modal — single button click.
- **Drag into Lost:** opens Loss Reason modal.
- **Drag out of Won (any company):** opens `DestructiveConfirmModal` requiring company-name typing.

### 5.6 Stale deal visual treatment

See §8.

---

## 6. Billing mode (Q2 lock)

### 6.1 The `Company.billing_mode` field

Two values:
- **`stripe`** (default) — Won transitions are webhook-driven. Manual drag into Won requires typing the company name as a safety check.
- **`manual`** — for clients invoiced outside Stripe (cash, BACS, branded invoice with 30-day terms, etc.). Manual drag into Won is allowed with a simple confirm.

Set on the Company profile, not on individual Deals. A Company is either Stripe-billed or manually-billed across all its Deals.

### 6.2 Why this exists

Stripe is the default and the safest path. But some clients (especially larger ones, see `project_client_size_diversity.md`) require traditional invoicing. The `manual` mode unlocks:
- Manual Won transitions
- The future Branded Invoicing flow (separate Phase 3 spec)
- Suppression of Stripe-related cockpit nudges for that company

---

## 7. Component primitives needed

### 7.1 Already in design system baseline

- `AdminShell`, `KanbanBoard`, `EmptyState`, `ToastWithSound`, `SoundProvider`, `MotionProvider`

### 7.2 New primitives this spec adds

- **`SheetWithSound`** — slide-over panel for Deal detail. Right-edge slide-in, house spring, plays the `whoosh-soft` sound from the registry. Used for the Deal detail view, the Contact detail view, and the Trial Shoot panel.
- **`DestructiveConfirmModal`** — generic confirm modal for high-stakes destructive actions. Two modes: `simple` (single button) and `type-to-confirm` (requires typing a string, button disabled until match). Also used by Loss Reason modal and any future destructive primitive.

### 7.3 New design-system addition request

The two-tier card hover-overlay is Tier 1 only (house spring) and does not need a Tier 2 slot. However, the **`RETAINER` / `SAAS` badge on Won cards** uses Black Han Sans at caption size. This is a new BHS location and must be added to the closed list of 8 BHS locations in `docs/specs/design-system-baseline.md` §6 (Q6 in that spec).

**Action item for next design-system update:** add "Won card outcome badge (RETAINER/SAAS)" as the 9th BHS location, OR replace one of the existing 8 to keep the count at 8. Andy's call.

---

## 8. Stale deal aging (Q14 lock)

### 8.1 Per-stage staleness thresholds

| Stage | Stale after | Reasoning |
|---|---|---|
| Lead | 14 days | Hasn't been contacted, slowly decays in priority |
| Contacted | 5 days | They haven't replied — chase soon |
| Conversation | 7 days | Conversation went quiet |
| Trial Shoot | 14 days post-`completed_awaiting_feedback` | Waiting on questionnaire |
| Quoted | 5 days | Quote is in their hands, decision overdue |
| Negotiating | 3 days | Active negotiation should be tight |
| Won | never | Terminal |
| Lost | never | Terminal |

A Deal is "stale" when `now() - last_stage_change_at > threshold_for_current_stage` AND `snoozed_until IS NULL OR snoozed_until < now()`.

### 8.2 Visual treatment

Stale cards get a soft amber halo (a 2px outer glow at `--color-warning` 30% alpha, no shadow, composes with the inner highlight). The halo uses the house spring to fade in when the card first becomes stale (Tier 1 motion only).

### 8.3 Snooze affordance

Quick action on the hover-expanded card: `Snooze` opens a small popover with options (1 day / 3 days / 1 week / custom). Sets `snoozed_until`. Cards that are snoozed don't display the halo until the snooze expires.

### 8.4 Auto-nudge generation (DEFERRED to v1.1)

The auto-nudge generation flow reuses the Lead Generation outreach pipeline. **Lead Gen does not exist yet** — its spec session is still ahead in Phase 3. Until Lead Gen ships, the `Send nudge` button on stale cards opens a simple compose-and-send modal (using a basic Resend send wrapper). The auto-generated draft using the Lead Gen pipeline is a Phase 5 enhancement that lights up automatically when Lead Gen lands.

---

## 9. Trial Shoot panel (Q12 lock)

### 9.1 Where it lives

On the Company profile (which is owned by the Client Management spec, but the Trial Shoot panel is defined here because it's load-bearing for the Pipeline). Surfaced as a tab or expandable section labelled "Trial Shoot".

### 9.2 What it shows

- **Plan:** free-form text field — `Company.trial_shoot_plan`. Andy fills this in when the trial shoot is booked.
- **Feedback questionnaire answers:** rendered from `Company.trial_shoot_feedback` (JSON or text — final shape locked in Intro Funnel spec).
- **Status timeline:** horizontal stepper showing the 5 sub-statuses: `booked → planned → in_progress → completed_awaiting_feedback → completed_feedback_provided`. Current status highlighted, prior statuses checked, future statuses dim.
- **Completion timestamp:** `trial_shoot_completed_at`, displayed when status reaches one of the `completed_*` states.

### 9.3 Sub-status transitions

These do **not** affect the Deal stage — the Deal sits in `Trial Shoot` for the entire duration of the trial. Sub-statuses are advanced manually by Andy (with one auto-trigger: `feedback_received` activity entry from the questionnaire form auto-flips to `completed_feedback_provided`).

Once feedback is provided, Andy can hand-craft a quote in Quote Builder, which advances the Deal to `Quoted`.

---

## 10. Integrations (the touchpoints)

### 10.1 Stripe webhooks

**Handled events:**
- `checkout.session.completed` (intro product) → set Deal stage to `Trial Shoot`, set `Company.trial_shoot_status = 'booked'`, log activity
- `checkout.session.completed` (retainer product) → set Deal stage to `Won`, `won_outcome = 'retainer'`, populate `value_cents` and `value_estimated = false`, log activity, fire customer-warmth toast/sound
- `checkout.session.completed` (SaaS product) → set Deal stage to `Won`, `won_outcome = 'saas'`, populate `value_cents`, log activity, fire customer-warmth toast/sound
- `invoice.payment_succeeded` (recurring) → no stage change, log `payment_received` activity, update Company `last_payment_at`
- `invoice.payment_failed` → no stage change, log activity, fire **urgent** toast/sound (this is the only payment-related event that fires the urgent sound)

**Discipline:**
- Every webhook handler verifies the Stripe signature.
- Every handler writes to `webhook_events` first (idempotent on event ID), then processes. Replay-safe.
- All Stripe interaction is behind a `lib/integrations/stripe.ts` adapter (per Phase 2 build discipline).

### 10.2 Resend webhooks

**Handled events:**
- `email.sent` (outbound) → log activity, advance stage if first-send-to-this-deal
- `email.delivered` → no stage change, optional activity log
- `email.bounced` → see §3.4
- `email.complained` → see §3.4
- Inbound parsing webhook → match by recipient + threading headers, log `email_received`, advance `Contacted → Conversation` if applicable

All Resend interaction is behind a `lib/integrations/resend.ts` adapter.

### 10.3 Quote Builder (future spec)

Calls into the pipeline via two functions:
- `attachQuoteToDeal(dealId, quote)` — sets `value_cents`, `value_estimated = false`, logs `quote_sent`, advances stage to `Quoted`
- `markQuoteAccepted(dealId, paymentIntent)` — internal, called from Stripe webhook handler

### 10.4 Lead Generation (future spec)

Calls into the pipeline via:
- `createDealFromLead(companyData, contactData, source)` — lookup-or-create Company + Contact, then create a new Deal. **Contact dedupe rule** (added 2026-04-13 Phase 3.5 Step 11): match existing contact on normalised `email`, then normalised `phone` as fallback. On match, reuse the contact row (update any newly-supplied fields via a non-destructive merge — never overwrite a populated field with `null`) and attach the new Deal to that contact's existing Company. Never create a duplicate contact for the same email/phone. Company dedupe follows the same rule on normalised company name + domain. Default stage is `Lead` except where `source` dictates otherwise (e.g. `intro_funnel_contact_submitted` → `Trial Shoot`).
- `attachOutboundEmailToDeal(dealId, emailRecord)` — logs activity, triggers `Lead → Contacted` on first send

### 10.5 Unified Inbox (future spec)

Calls into the pipeline via:
- `attachInboundEmailToDeal(dealId, emailRecord)` — logs activity, triggers `Contacted → Conversation` on first inbound match
- `manualMarkReplied(dealId)` — for replies that came outside the inbox (phone, in-person)

### 10.6 Daily Cockpit (future spec)

Reads:
- Stale deal count + list
- Deals in `Quoted` and `Negotiating` (highest-priority morning view)
- Recent stage transitions (last 24h)
- Won this week (count + value sum)
- Lost this week (count + reason breakdown)

---

## 11. Sounds

From the locked sound registry (design system baseline §10):
- `whoosh-soft` — slide-over open (Deal detail panel)
- `tick-warm` — successful drag-and-drop settle
- `chime-bright` — `Won` transition (Stripe-driven OR manual)
- `urgent-thud` — bounce / complaint webhook fires; payment failed
- `glass-tap` — generic UI confirm (modal buttons)

All sounds gated by the `prefersSound` user preference (Settings → Display).

---

## 11A. Voice & Delight treatment (added 2026-04-13 Phase 3.5)

Pipeline is an admin surface, so voice is dry-observational (admin-roommate register) rather than client-polished. This section makes the cross-cutting Voice & Delight discipline concrete for Pipeline.

### 11A.1 Empty states

Every column, feed, and panel uses the locked `EmptyState` primitive with a copy entry from the central empty-state bank (design system baseline). Pipeline-specific entries:

- **`Lead` column empty** — *"No leads yet. Lead Gen will fill this in when it's built."*
- **`Contacted` column empty** — *"Nothing out there waiting for a reply. Enviable."*
- **`Won` column empty** — *"Quiet in here. For now."*
- **`Lost` column empty** — *"Either we're winning everything or you haven't updated this in a while. One of those."*
- **Deal activity feed empty** — *"Nothing's happened here yet. Deal's too new to gossip about."*
- **Company feed empty on a brand-new Company** — *"First note, first entry. Tidy."*

Copy lives in `lib/copy/empty-states.ts` keyed by surface + context, not duplicated inline. Sprinkle bank claim: Pipeline consumes ~6 entries, all within admin-voice budget.

### 11A.2 Toasts

All Pipeline toasts go through the locked `toast()` primitive (design system baseline §6). Sound pairings from §11 apply automatically — feature code never calls sound APIs directly.

Pipeline-specific toast copy (dry, never cheerleading):
- **Stage advance (non-Won):** *"Moved to {stage}."*
- **Won (Stripe-driven):** *"{Company} converted. Nice."* + `chime-bright`
- **Won (manual):** *"Logged as Won. Hope you invoiced them."* + `chime-bright`
- **Lost:** *"Marked Lost. Reason saved."* + no sound (muted event)
- **Bounce rollback:** *"{Contact} bounced. Deal rolled back to Lead."* + `urgent-thud`
- **Snoozed:** *"Snoozed until {date}."* + `tick-warm`

Never use exclamation marks except on `Won`. Never say "success" or "🎉".

### 11A.3 Tier 2 cinematic discipline

Pipeline is explicitly **closed-list Tier 2 budget = 0**. No cinematic moments on this surface. Card hover, drag settle, and Won chime are Tier 1 only. This is deliberate — reserves the Tier 2 budget for client-facing flagship surfaces.

### 11A.4 Surprise & Delight hooks

Pipeline is **admin-roommate register only** for S&D. Eligible ambient moments:
- Very rare (≤ once/month, registry-gated) easter-egg toast when Andy closes 3 Won deals in a single session: *"That's three. Either you're crushing it or it's a slow Tuesday."*
- No ambient moments on Lost / bounce / rollback events. Those stay dry.

S&D data-access: reads only `deals`, `activity_log`, Andy's session timestamps. No cross-client inference. Registered in the S&D audit checklist (see surprise-and-delight.md §[audit]).

---

## 12. Build-time disciplines (specific to Pipeline)

In addition to the 11 disciplines in the design system baseline:

1. **Webhook idempotency from day one.** No exceptions. Every Stripe and Resend handler writes to `webhook_events` before processing.
2. **`validateDeal()` runs on every Deal write.** No bypasses, no "I'll add validation later".
3. **Activity log writes are append-only.** No updates, no deletes. The audit trail is sacred.
4. **Stage transitions go through one function.** `transitionDealStage(dealId, fromStage, toStage, source)` is the only entry point. It validates the transition is legal, writes the activity log, fires the right sound/toast, updates `last_stage_change_at`, and resets `next_action_overridden_at`. Direct UPDATE statements on `deals.stage` are forbidden.
5. **The KanbanBoard and activity_log primitives must be generic enough to reuse for the Hiring Pipeline** (future spec). When building, do not hardcode "deal" terminology into the primitive — the primitive takes generic `Card` and `Column` props. Pipeline-specific logic lives in a thin Pipeline-specific layer on top.
6. **Drizzle check constraints + validation function.** Both. Belt and braces — the DB enforces what it can, the function enforces the rest.
7. **No raw `process.env.STRIPE_*`** anywhere outside `lib/integrations/stripe.ts`.

---

## 13. Success criteria

Sales Pipeline ships when:

1. All 8 stages render in the Kanban with correct ordering and warm-tint progression.
2. A Stripe `checkout.session.completed` test webhook successfully advances a Deal to `Won` and fires the customer-warmth sound.
3. A Resend `email.bounced` test webhook rolls back a `Contacted` Deal to `Lead`, marks the Contact `invalid`, and opens the multi-contact picker.
4. Manual drag-into-Won on a Stripe-billed company requires typing the company name; on a manual-billed company, it requires only a single click.
5. Loss Reason modal is required for every Lost transition, and the closed list of 7 reasons is enforced.
6. The two-tier card with hover-expanded overlay works on desktop and is excluded on mobile (tap-to-open instead).
7. Stale-deal halo appears on cards past their per-stage threshold and disappears when snoozed.
8. The Trial Shoot panel on the Company profile shows plan + questionnaire + sub-status timeline + completion timestamp.
9. All three activity feeds (Deal / Contact / Company) query correctly from the single `activity_log` table.
10. `validateDeal()` rejects every illegal state combination listed in §4.2.
11. The full `density-comfort` + `theme-standard` + `typeface-house` baseline renders with no layout breakage. Reduced-motion + sounds-off + large-text variant is usable.

---

## 14. Out of scope (explicit non-goals)

1. **Branded invoicing.** Manual-billed companies set `billing_mode = 'manual'`, but the actual invoice generation/sending UI is a separate Phase 3 spec.
2. **Intro Funnel.** The Trial Shoot stage receives data from this funnel — but the funnel landing page, questionnaire form, fulfillment workflow, and customer-side trial shoot view are a separate Phase 3 spec.
3. **Lead Generation outreach drafting.** Pipeline displays nudge buttons, but the actual draft-and-send pipeline lives in Lead Generation spec.
4. **Quote Builder.** Pipeline has the integration touchpoints, but the quote authoring UI, line items, PDF generation, etc. are a separate spec.
5. **Client Management graduation.** Won Deals notify Client Management; the actual client onboarding flow lives there.
6. **SaaS subscription lifecycle.** `won_outcome = 'saas'` Deals hand off to SaaS Subscription Billing spec at the moment of Won.
7. **Hiring Pipeline.** Reuses the same `KanbanBoard` and `activity_log` primitives, but with completely different stages and entities. Separate spec.
8. **Mobile-optimised drag.** Desktop-first per the design system. Mobile DnD polish is a Phase 6 task.
9. **Pipeline-wide search.** FTS5 search across Deals/Contacts/Companies is a separate Phase 5 search session.
10. **Reporting / analytics dashboards.** Loss reason breakdown, conversion funnel, etc. live in the Cockpit spec or a future analytics spec.

---

## 15. Open questions deferred to Phase 5

1. Exact pixel values for the warm-tint column backgrounds (starting points: Lead = neutral-1, Contacted = neutral-2, Conversation = neutral-3, Trial Shoot = neutral-3 + pink wash, Quoted = neutral-4, Negotiating = neutral-5, Won = neutral-2 + cream wash, Lost = neutral-6 desaturated). In-browser tuning needed.
2. Exact `email.bounced` retry timing for soft bounces (24h is a starting point, may need adjustment after Resend testing).
3. The `feedback_received` auto-trigger from the Intro Funnel questionnaire — exact webhook payload shape locked in Intro Funnel spec.
4. Exact copy for the empty state of each of the 8 columns. Drafted per-column in `lib/empty-state-copy.ts`.
5. The hover-intent delay value (300ms is a starting point; may need to feel snappier in-browser).

---

## 16. Risks (carried into Phase 5)

1. **Stripe webhook reliability is the single biggest risk.** Mitigation: idempotency table from day one, signature verification, generous Phase 5 budget for the dedicated webhook session.
2. **Resend bounce/complaint rollback chain has a lot of edge cases.** Mitigation: bounce-handler-only Phase 5 session with comprehensive test fixtures.
3. **Cross-spec coupling.** Every other Phase 3 spec will want to touch this one. Mitigation: the integration touchpoints in §10 are the contract — future specs implement against these signatures.
4. **The Hiring Pipeline reusability claim** (`KanbanBoard` and `activity_log` are generic enough) is true by construction only if we hold the discipline. Mitigation: build-time rule §12.5.
5. **Tier 2 motion temptation.** The Won transition is a perfect candidate for a cinematic moment — but it's not on the locked Tier 2 list. Mitigation: house spring + chime-bright sound is enough. Resist.

---

## 17. Glossary

- **Deal** — an opportunity. Owned by a Company, optionally tied to a primary Contact.
- **Stage** — one of the 8 columns in the Kanban.
- **Stage transition** — any movement of a Deal from one stage to another, auto or manual.
- **Auto-transition** — a transition triggered by a system event (webhook).
- **Manual transition** — a transition triggered by Andy dragging a card.
- **Stale** — a Deal that has sat in its current stage longer than the per-stage threshold without being snoozed.
- **Snooze** — temporarily suppress the stale halo on a Deal.
- **Won outcome** — `retainer` or `saas`. Required when a Deal reaches Won.
- **Loss reason** — one of 7 closed-list reasons. Required when a Deal reaches Lost.
- **Billing mode** — `stripe` or `manual`, set per Company. Controls whether manual Won drag requires type-to-confirm.
- **Activity log** — append-only event stream. Three nullable FKs allow scoping queries to Deal / Contact / Company.
