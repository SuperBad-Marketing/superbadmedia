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
export type {
  GraphCredentials,
  GraphMessage,
  GraphDeltaResponse,
  GraphSubscription,
  GraphWebhookNotification,
} from "./types";
