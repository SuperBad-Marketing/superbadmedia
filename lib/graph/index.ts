export {
  createGraphClient,
  exchangeCodeForTokens,
  getValidAccessToken,
  encryptCredentials,
  createGraphSubscription,
  renewGraphSubscription,
  getActiveGraphState,
  type GraphClient,
} from "./client";
export { normalizeGraphMessage, type NormalizedMessage } from "./normalize";
export { resolveThread, updateThreadTimestamps } from "./thread";
export { runDeltaSync, syncSentItems, type SyncResult } from "./sync";
export { sendViaGraph, type SendViaGraphInput, type SendViaGraphResult } from "./send";
export {
  classifyAndRouteInbound,
  RouterOutputSchema,
  type RouterOutput,
  type RouterResult,
} from "./router";
export { buildRouterPrompt, loadRouterPromptContext } from "./router-prompt";
export {
  classifyNotificationPriority,
  NotifierOutputSchema,
  type NotifierOutput,
  type NotifierResult,
} from "./notifier";
export {
  buildNotifierPrompt,
  loadNotifierPromptContext,
  type NotifierPromptContext,
  type NotifierThreadContext,
} from "./notifier-prompt";
export {
  classifySignalNoise,
  recomputeThreadKeepUntil,
  computeMessageKeepUntilMs,
  SignalNoiseOutputSchema,
  type SignalNoiseOutput,
  type SignalNoiseResult,
  type ThreadKeepOverrides,
} from "./signal-noise";
export {
  buildSignalNoisePrompt,
  loadSignalNoisePromptContext,
  type SignalNoisePromptContext,
  type SignalNoiseThreadContext,
} from "./signal-noise-prompt";
export {
  generateCachedDraftReply,
  invalidateCachedDraft,
  DraftReplyOutputSchema,
  DraftReplyLowConfidenceFlagSchema,
  type DraftReplyOutput,
  type DraftReplyLowConfidenceFlag,
  type DraftReplyResult,
  type DraftReplyOutcome,
} from "./draft-reply";
export {
  loadDraftReplyPromptContext,
  buildDraftReplyUserPrompt,
  buildDraftReplySystemPrompt,
  loadClientContextOrStub,
  type DraftReplyPromptContext,
  type ClientContextSnapshot,
  type BrandDnaContext,
  type FewShotExample,
  type ThreadMessageSnapshot,
} from "./draft-reply-prompt";
export {
  generateComposeDraft,
  generateComposeSubject,
  buildComposeUserPrompt,
  ComposeSubjectOutputSchema,
  COMPOSE_SUBJECT_MAX_LEN,
  type ComposeDraftOutcome,
  type ComposeDraftResult,
  type ComposeSubjectOutcome,
  type ComposeSubjectResult,
  type GenerateComposeDraftInput,
  type GenerateComposeSubjectInput,
} from "./compose-draft";
export {
  resolveRecipientContact,
  ensureThreadForCompose,
  sendComposeMessage,
  saveComposeDraftRow,
  textToSimpleHtml,
  type ResolveRecipientResult,
  type EnsureThreadInput,
  type SendComposeInput,
  type SendComposeResult,
  type SaveComposeDraftInput,
} from "./compose-send";
export type {
  GraphCredentials,
  GraphMessage,
  GraphDeltaResponse,
  GraphSubscription,
  GraphWebhookNotification,
} from "./types";
