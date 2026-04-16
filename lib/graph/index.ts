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
export type {
  GraphCredentials,
  GraphMessage,
  GraphDeltaResponse,
  GraphSubscription,
  GraphWebhookNotification,
} from "./types";
