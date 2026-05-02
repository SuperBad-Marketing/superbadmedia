/**
 * LLM model registry — **the sole mapping of job slug → model ID**.
 *
 * Feature code asks for a job slug, never a model ID. Per memory
 * `project_llm_model_registry` and FOUNDATIONS §11.6. Enforced by the
 * `no-direct-anthropic-import` ESLint rule in `lib/eslint-rules/`.
 *
 * Slugs are the canonical set declared in `lib/ai/prompts/INDEX.md`
 * (53 entries, 14 specs, 2026-04-13).
 *
 * Tier mapping follows each prompt's INDEX.md tier column: Opus for
 * creative / high-stakes reasoning, Haiku for classification + short
 * templated drafts.
 */

export type ModelTier = "opus" | "sonnet" | "haiku";

export const MODEL_IDS = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
} as const satisfies Record<ModelTier, string>;

export type ModelId = (typeof MODEL_IDS)[ModelTier];

export const MODELS = {
  // quote-builder (8)
  "quote-builder-draft-from-context": "opus",
  "quote-builder-draft-intro-paragraph": "opus",
  "quote-builder-draft-send-email": "opus",
  "quote-builder-draft-scope-summary": "haiku",
  "quote-builder-draft-pdf-cover-line": "opus",
  "quote-builder-draft-settle-email": "opus",
  "quote-builder-draft-cancel-intercept-email": "opus",
  "quote-builder-draft-reminder-3d": "opus",
  // branded-invoicing (3)
  "invoice-draft-send-email": "opus",
  "invoice-draft-reminder": "opus",
  "invoice-draft-supersede-notification": "haiku",
  // intro-funnel (5)
  "intro-funnel-signal-tag-extraction": "haiku",
  "intro-funnel-reflection-synthesis": "opus",
  "intro-funnel-retainer-fit-recommendation": "opus",
  "intro-funnel-abandon-email": "haiku",
  "intro-funnel-apology-email": "haiku",
  // client-context-engine (5)
  "client-context-summarise": "haiku",
  "client-context-extract-action-items": "haiku",
  "client-context-draft-reply": "opus",
  "client-context-regenerate-draft-with-nudge": "opus",
  "client-context-reformat-draft-for-channel": "haiku",
  // brand-dna-assessment (5)
  "brand-dna-generate-section-insight": "opus",
  "brand-dna-generate-first-impression": "opus",
  "brand-dna-generate-prose-portrait": "opus",
  "brand-dna-generate-company-blend": "opus",
  "brand-dna-generate-retake-comparison": "opus",
  "brand-dna-generate-brand-pack": "opus",
  "brand-dna-generate-signal-scores-intro": "opus",
  "brand-dna-generate-signal-descriptions": "opus",
  "brand-dna-generate-gap-reveal": "opus",
  "brand-dna-generate-long-tail-summary": "opus",
  "brand-dna-generate-marketing-playbook": "opus",
  // content-engine (10)
  "content-score-keyword-rankability": "haiku",
  "content-generate-topic-outline": "haiku",
  "content-generate-blog-post": "opus",
  "content-rewrite-for-newsletter": "haiku",
  "content-generate-social-draft": "haiku",
  "content-select-visual-template": "haiku",
  "content-generate-image-prompt": "haiku",
  "content-match-content-to-prospects": "haiku",
  "content-draft-outreach-email": "opus",
  "content-generate-embed-form-styles": "haiku",
  // six-week-plan-generator (4)
  "six-week-plan-strategy": "opus",
  "six-week-plan-weeks": "opus",
  "six-week-plan-review": "haiku",
  "six-week-plan-revision-reply": "haiku",
  // cost-usage-observatory (3)
  "observatory-diagnose-cost-anomaly": "opus",
  "observatory-draft-negative-margin-email": "opus",
  "observatory-draft-weekly-digest": "haiku",
  // finance-dashboard (1)
  "finance-draft-narrative": "haiku",
  // daily-cockpit (1)
  "cockpit-brief": "opus",
  // lead-generation (4)
  "lead-gen-outreach-draft": "opus",
  "lead-gen-nudge-rewrite": "opus",
  "lead-gen-case-snippet": "haiku",
  "lead-gen-candidate-summary": "haiku",
  "lead-gen-suggest-search": "haiku",
  "lead-gen-discovery-suggestions": "haiku",
  "lead-gen-icp-prefilter": "haiku",
  "lead-gen-deep-website-distill": "haiku",
  "lead-gen-reply-draft": "opus",
  "lead-gen-reply-nudge": "opus",
  "lead-gen-reply-long-tail": "opus",
  "lead-gen-reply-classify": "haiku",
  "lead-gen-soft-adjustment": "haiku",
  // video-studio (1)
  "video-brief-builder": "haiku",
  "video-prompt-optimise": "sonnet",
  // client-management (3)
  "client-mgmt-bartender-opening-line": "haiku",
  "client-mgmt-chat-response": "opus",
  "client-mgmt-escalation-summary": "haiku",
  // referral (1)
  "referral-follow-up-draft": "opus",
  // braindump (1)
  "braindump-parse": "sonnet",
  // unified-inbox (8)
  "inbox-classify-inbound-route": "haiku",
  "inbox-classify-notification-priority": "haiku",
  "inbox-classify-signal-noise": "haiku",
  "inbox-classify-support-ticket-type": "haiku",
  "inbox-draft-reply": "opus",
  "inbox-compose-draft": "opus",
  "inbox-compose-subject": "haiku",
  "inbox-draft-refine": "opus",
  // hiring-pipeline (9)
  "hiring-brief-synthesize": "sonnet",
  "hiring-discovery-agent": "sonnet",
  "hiring-candidate-score": "haiku",
  "hiring-invite-draft": "sonnet",
  "hiring-followup-question-draft": "haiku",
  "hiring-trial-task-author": "sonnet",
  "hiring-portfolio-ingest-vision": "sonnet",
  "hiring-archive-reflection-ingest": "haiku",
  "hiring-reply-classify": "haiku",
  // onboarding (2) — OS-1
  "onboarding-welcome-email": "opus",
  "onboarding-welcome-summary": "opus",
  // setup-wizards (1) — CMS-2
  "admin-setup-assistant": "opus",
  // cockpit-assistant (1)
  "cockpit-assistant": "sonnet",
  // email-adapter / drift-check (1) — A7
  "drift-check-grader": "haiku",
  // surprise-and-delight (4) — SD-2 + SD-4 + SD-10
  "sd-generate-in-voice": "haiku",
  "sd-milestone-extract": "haiku",
  "sd-milestone-draft": "opus",
  "sd-riddle-wrong-fallback": "haiku",
  // free-audit-tool (2)
  "audit-category-explanation": "haiku",
  "audit-followup-draft": "opus",
  // rundown-sequence (2)
  "rundown-sequence-draft-email": "opus",
  "rundown-sequence-classify-reply": "haiku",
  // content-studio (4)
  "content-studio-generate-copy": "sonnet",
  "content-studio-generate-motion-copy": "sonnet",
  "content-studio-correct-copy": "sonnet",
  "content-studio-pick-template": "haiku",
  // catalogue-chat (1)
  "catalogue-chat-recommend": "sonnet",
  // brief-storyboards (2)
  "brief-storyboard-generate": "opus",
  "brief-storyboard-revise": "opus",
  // instagram-channel (8)
  "instagram-draft-caption": "sonnet",
  "instagram-classify-inbound": "haiku",
  "instagram-draft-comment-reply": "sonnet",
  "instagram-draft-dm-reply": "sonnet",
  "instagram-escalation-summary": "haiku",
  "instagram-strategy-digest": "sonnet",
  "instagram-realtime-alert": "haiku",
  "instagram-boost-rationale": "haiku",
  "instagram-trigger-dm-draft": "sonnet",
  // talking-head-scripts (3)
  "talking-head-generate-script": "opus",
  "talking-head-generate-edit-brief": "haiku",
  "talking-head-generate-publish-meta": "haiku",
  // call-notes (3)
  "call-pre-briefing": "opus",
  "call-custom-questions": "haiku",
  "call-post-synthesis": "opus",
  // meta-campaigns (2)
  "meta-campaign-strategy-builder": "opus",
  "meta-ad-copy-generate": "sonnet",
  // instagram-competitive-strategy (3)
  "instagram-competitive-strategy": "sonnet",
  "instagram-post-why-high": "haiku",
  "instagram-taste-analysis": "haiku",
  // braindump mood signal (1)
  "braindump-mood-signal": "haiku",
  // business-profile (2)
  "profile-generate-prose-summary": "haiku",
  "profile-refine-braindump": "sonnet",
  // productions (2)
  "productions-angle-gen": "sonnet",
  "productions-brainstorm": "sonnet",
  // projects (1)
  "project-breakdown": "opus",
} as const satisfies Record<string, ModelTier>;

export type ModelJobSlug = keyof typeof MODELS;

export const MODEL_JOB_SLUGS = Object.keys(MODELS) as ModelJobSlug[];

/**
 * Resolve a job slug to the concrete model ID it should call today.
 * Swap model tiers platform-wide by editing the `MODELS` map — no
 * feature code change required.
 */
export function modelFor(job: ModelJobSlug): ModelId {
  return MODEL_IDS[MODELS[job]];
}

export function modelTierFor(job: ModelJobSlug): ModelTier {
  return MODELS[job];
}

const PROFILE_INJECTION_EXCLUDED: ReadonlySet<ModelJobSlug> = new Set([
  // Brand DNA generators — writing about a subject, not as SuperBad
  "brand-dna-generate-section-insight",
  "brand-dna-generate-first-impression",
  "brand-dna-generate-prose-portrait",
  "brand-dna-generate-company-blend",
  "brand-dna-generate-retake-comparison",
  "brand-dna-generate-brand-pack",
  "brand-dna-generate-signal-scores-intro",
  "brand-dna-generate-signal-descriptions",
  "brand-dna-generate-gap-reveal",
  "brand-dna-generate-long-tail-summary",
  "brand-dna-generate-marketing-playbook",
  // Classification / extraction — pure analysis, no voice
  "intro-funnel-signal-tag-extraction",
  "lead-gen-icp-prefilter",
  "lead-gen-reply-classify",
  "lead-gen-soft-adjustment",
  "inbox-classify-inbound-route",
  "inbox-classify-notification-priority",
  "inbox-classify-signal-noise",
  "inbox-classify-support-ticket-type",
  "inbox-compose-subject",
  "instagram-classify-inbound",
  "hiring-candidate-score",
  "hiring-archive-reflection-ingest",
  "hiring-reply-classify",
  "drift-check-grader",
  "six-week-plan-review",
  "content-score-keyword-rankability",
  "content-select-visual-template",
  "content-generate-image-prompt",
  "content-match-content-to-prospects",
  // Parsing / internal — no voice generation
  "braindump-parse",
  "braindump-mood-signal",
  "finance-draft-narrative",
  "call-custom-questions",
  // Profile's own generators — avoid circular injection
  "profile-generate-prose-summary",
  "profile-refine-braindump",
  // Projects — structural analysis, no voice
  "project-breakdown",
]);

export function isProfileInjectionExcluded(job: ModelJobSlug): boolean {
  return PROFILE_INJECTION_EXCLUDED.has(job);
}

// ---------------------------------------------------------------------------
// Job priority — interactive (user waiting) vs deferrable (background/batch)
// ---------------------------------------------------------------------------

export type JobPriority = "interactive" | "deferrable";

const DEFERRABLE_JOBS: ReadonlySet<ModelJobSlug> = new Set([
  // Lead gen — batch enrichment, outreach, classification
  "lead-gen-outreach-draft",
  "lead-gen-nudge-rewrite",
  "lead-gen-case-snippet",
  "lead-gen-candidate-summary",
  "lead-gen-suggest-search",
  "lead-gen-discovery-suggestions",
  "lead-gen-icp-prefilter",
  "lead-gen-deep-website-distill",
  "lead-gen-reply-classify",
  "lead-gen-soft-adjustment",
  // Content engine — batch scoring, generation, matching
  "content-score-keyword-rankability",
  "content-generate-topic-outline",
  "content-generate-blog-post",
  "content-rewrite-for-newsletter",
  "content-generate-social-draft",
  "content-select-visual-template",
  "content-generate-image-prompt",
  "content-match-content-to-prospects",
  "content-draft-outreach-email",
  "content-generate-embed-form-styles",
  // Intro funnel — automated classification & emails
  "intro-funnel-signal-tag-extraction",
  "intro-funnel-abandon-email",
  "intro-funnel-apology-email",
  // Client context — background summarisation
  "client-context-summarise",
  "client-context-extract-action-items",
  "client-context-reformat-draft-for-channel",
  // Inbox — auto-classification
  "inbox-classify-inbound-route",
  "inbox-classify-notification-priority",
  "inbox-classify-signal-noise",
  "inbox-classify-support-ticket-type",
  "inbox-compose-subject",
  // Hiring — background scoring & processing
  "hiring-brief-synthesize",
  "hiring-discovery-agent",
  "hiring-candidate-score",
  "hiring-invite-draft",
  "hiring-followup-question-draft",
  "hiring-trial-task-author",
  "hiring-portfolio-ingest-vision",
  "hiring-archive-reflection-ingest",
  "hiring-reply-classify",
  // Six-week plan — background validation
  "six-week-plan-review",
  "six-week-plan-revision-reply",
  // Observatory & finance — cron-driven
  "observatory-diagnose-cost-anomaly",
  "observatory-draft-negative-margin-email",
  "observatory-draft-weekly-digest",
  "finance-draft-narrative",
  // Drift check — automated grading
  "drift-check-grader",
  // Surprise and delight — automated
  "sd-generate-in-voice",
  "sd-milestone-extract",
  "sd-riddle-wrong-fallback",
  // Background helpers
  "quote-builder-draft-scope-summary",
  "invoice-draft-supersede-notification",
  "video-brief-builder",
  "client-mgmt-bartender-opening-line",
  "client-mgmt-escalation-summary",
  "referral-follow-up-draft",
  // Instagram — auto-classification & batch analysis
  "instagram-classify-inbound",
  "instagram-escalation-summary",
  "instagram-strategy-digest",
  "instagram-realtime-alert",
  "instagram-boost-rationale",
  "instagram-competitive-strategy",
  "instagram-post-why-high",
  "instagram-taste-analysis",
  // Talking head — background generation
  "talking-head-generate-edit-brief",
  "talking-head-generate-publish-meta",
  // Call notes — background prep
  "call-custom-questions",
  // Rundown — automated sequences
  "rundown-sequence-draft-email",
  "rundown-sequence-classify-reply",
  // Content studio — background template selection
  "content-studio-pick-template",
  // Audit — background explanation
  "audit-category-explanation",
]);

export function jobPriorityFor(job: ModelJobSlug): JobPriority {
  return DEFERRABLE_JOBS.has(job) ? "deferrable" : "interactive";
}
