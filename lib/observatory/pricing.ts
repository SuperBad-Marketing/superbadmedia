/**
 * Estimated AUD cost formulas per vendor / model tier.
 *
 * v1 uses hardcoded pricing from public vendor rate cards + a static
 * USD→AUD multiplier. Reconciliation against actual invoices is v1.1.
 * Accuracy target: ±15% (spec §1).
 */
import type { ModelTier } from "@/lib/ai/models";

const USD_TO_AUD = 1.55;

// Anthropic per-million-token pricing (USD, May 2025 rate card)
const ANTHROPIC_RATES: Record<
  ModelTier,
  { inputPerMillion: number; outputPerMillion: number }
> = {
  opus: { inputPerMillion: 15, outputPerMillion: 75 },
  sonnet: { inputPerMillion: 3, outputPerMillion: 15 },
  haiku: { inputPerMillion: 0.8, outputPerMillion: 4 },
};

export interface AnthropicUsage {
  inputTokens: number;
  outputTokens: number;
}

export function estimateAnthropicCostAud(
  tier: ModelTier,
  usage: AnthropicUsage,
): number {
  const rates = ANTHROPIC_RATES[tier];
  const usd =
    (usage.inputTokens / 1_000_000) * rates.inputPerMillion +
    (usage.outputTokens / 1_000_000) * rates.outputPerMillion;
  return Math.round(usd * USD_TO_AUD * 10000) / 10000;
}

export function estimateStripeCostAud(): number {
  return Math.round(0.005 * USD_TO_AUD * 10000) / 10000;
}

export function estimateResendCostAud(): number {
  return Math.round(0.001 * USD_TO_AUD * 10000) / 10000;
}

export function estimateTwilioCostAud(): number {
  return Math.round(0.0079 * USD_TO_AUD * 10000) / 10000;
}

export function estimateSerpApiCostAud(): number {
  return Math.round(0.01 * USD_TO_AUD * 10000) / 10000;
}

export function estimateZeroCostAud(): number {
  return 0;
}
