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
  // quote-builder (7)
  "quote-builder-draft-from-context": "opus",
  "quote-builder-draft-intro-paragraph": "opus",
  "quote-builder-draft-send-email": "opus",
  "quote-builder-draft-scope-summary": "haiku",
  "quote-builder-draft-pdf-cover-line": "opus",
  "quote-builder-draft-settle-email": "opus",
  "quote-builder-draft-cancel-intercept-email": "opus",
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
  // lead-generation (1)
  "lead-gen-outreach-draft": "opus",
  // client-management (3)
  "client-mgmt-bartender-opening-line": "haiku",
  "client-mgmt-chat-response": "opus",
  "client-mgmt-escalation-summary": "haiku",
  // task-manager (1)
  "task-manager-parse-braindump": "haiku",
  // unified-inbox (3)
  "inbox-classify-inbound-route": "haiku",
  "inbox-classify-notification-priority": "haiku",
  "inbox-classify-signal-noise": "haiku",
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
