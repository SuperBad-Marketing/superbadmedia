/**
 * Context-aware suppression gates for hidden eggs.
 * Hard gates — if any returns true, no egg fires.
 */

export interface SuppressionContext {
  isPaymentElementMounted: boolean;
  isEmailComposeFocused: boolean;
  isQuoteAcceptanceFlow: boolean;
  isErrorPage: boolean;
  isOnboardingWizard: boolean;
  isFirstEverLogin: boolean;
  sessionAgeMs: number;
}

const FIRST_30_SECONDS_MS = 30_000;

export function isSuppressed(ctx: SuppressionContext): boolean {
  if (ctx.isPaymentElementMounted) return true;
  if (ctx.isEmailComposeFocused) return true;
  if (ctx.isQuoteAcceptanceFlow) return true;
  if (ctx.isErrorPage) return true;
  if (ctx.isOnboardingWizard) return true;
  if (ctx.isFirstEverLogin) return true;
  if (ctx.sessionAgeMs < FIRST_30_SECONDS_MS) return true;
  return false;
}
