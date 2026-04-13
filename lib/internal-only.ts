/**
 * JSDoc marker for adapter-boundary discipline (FOUNDATIONS §F2.d).
 *
 * Adapter functions (Resend, Stripe, Anthropic) are gated by the ESLint
 * rules in `lib/eslint-rules/` — feature code in `app/` / `components/`
 * must never call them directly. This marker documents the intent at the
 * call-site level for functions that are technically importable but must
 * only be consumed from within their owning adapter module.
 *
 * Usage: add `@internal` JSDoc to any function that must not be called
 * outside its adapter boundary. ESLint enforces this via the
 * `no-direct-anthropic-import`, `no-direct-stripe-customer-create`, and
 * `no-direct-resend-send` rules. The marker here is supplementary
 * documentation for human readers.
 *
 * @example
 * // lib/channels/email/send.ts
 * /**
 *  * @internal Use only within lib/channels/email/ — consumers call
 *  * sendEmail() which enforces kill switches + suppression gates.
 *  *‌/
 * function resendSend(params: ResendParams) { ... }
 */

export const INTERNAL_ONLY = Symbol("internal-only");
export type InternalOnly = typeof INTERNAL_ONLY;
