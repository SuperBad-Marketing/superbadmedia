import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { QUOTE_BUILDER_HANDLERS } from "./quote-builder";
import { INVOICING_HANDLERS } from "@/lib/invoicing/handlers";
import { SAAS_SUBSCRIPTION_HANDLERS } from "./saas-subscription-usage-reset";
import { SAAS_TIER_CHANGE_HANDLERS } from "./saas-subscription-tier-downgrade-apply";
import { SAAS_DATA_LOSS_HANDLERS } from "./saas-data-loss-warning";
import { INBOX_SUBSCRIPTION_RENEW_HANDLERS } from "./inbox-graph-subscription-renew";
import { INBOX_HYGIENE_HANDLERS } from "./inbox-hygiene-purge";
import { INBOX_DRAFT_HANDLERS } from "./inbox-draft-generate";
import { INBOX_TICKET_AUTO_RESOLVE_HANDLERS } from "./inbox-ticket-auto-resolve";
import { INBOX_DIGEST_HANDLERS } from "./inbox-digest";
import { ONBOARDING_NUDGE_HANDLERS } from "./onboarding-nudges";
import { CONTENT_KEYWORD_RESEARCH_HANDLERS } from "./content-keyword-research";
import { CONTENT_GENERATE_DRAFT_HANDLERS } from "./content-generate-draft";
import { CONTENT_FAN_OUT_HANDLERS } from "./content-fan-out";
import { CONTENT_NEWSLETTER_SEND_HANDLERS } from "./content-newsletter-send";
import { CONTENT_RANKING_SNAPSHOT_HANDLERS } from "./content-ranking-snapshot";

/**
 * Single dispatch map consumed by `lib/scheduled-tasks/worker.ts`.
 *
 * Each feature area contributes its own `HandlerMap` block; this index
 * merges them into one. QB-1 seeds the Quote Builder block; downstream
 * specs (Branded Invoicing, Content Engine, etc.) add theirs by
 * registering a `*_HANDLERS` export and spreading it in below.
 *
 * Worker treats any missing handler for a pending task type as a hard
 * failure (`no handler for {type}`) — the registry is authoritative.
 */
export const HANDLER_REGISTRY: HandlerMap = {
  ...QUOTE_BUILDER_HANDLERS,
  ...INVOICING_HANDLERS,
  ...SAAS_SUBSCRIPTION_HANDLERS,
  ...SAAS_TIER_CHANGE_HANDLERS,
  ...SAAS_DATA_LOSS_HANDLERS,
  ...INBOX_SUBSCRIPTION_RENEW_HANDLERS,
  ...INBOX_HYGIENE_HANDLERS,
  ...INBOX_DRAFT_HANDLERS,
  ...INBOX_TICKET_AUTO_RESOLVE_HANDLERS,
  ...INBOX_DIGEST_HANDLERS,
  ...ONBOARDING_NUDGE_HANDLERS,
  ...CONTENT_KEYWORD_RESEARCH_HANDLERS,
  ...CONTENT_GENERATE_DRAFT_HANDLERS,
  ...CONTENT_FAN_OUT_HANDLERS,
  ...CONTENT_NEWSLETTER_SEND_HANDLERS,
  ...CONTENT_RANKING_SNAPSHOT_HANDLERS,
};
