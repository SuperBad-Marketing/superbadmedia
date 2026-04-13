/**
 * Email channel adapter — public barrel.
 *
 * Feature code imports from here. The individual module files contain
 * implementation details that are `@internal` to the adapter.
 */
export { sendEmail } from "./send";
export type { SendEmailParams, SendEmailResult } from "./send";
export { canSendTo } from "./can-send-to";
export type { CanSendToResult } from "./can-send-to";
export { isWithinQuietWindow } from "./quiet-window";
export {
  EMAIL_CLASSIFICATIONS,
  TRANSACTIONAL_CLASSIFICATIONS,
  isTransactional,
} from "./classifications";
export type { EmailClassification } from "./classifications";
