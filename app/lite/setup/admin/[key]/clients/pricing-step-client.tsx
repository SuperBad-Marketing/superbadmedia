"use client";

/**
 * `pricing` step for saas-product-setup (SB-2b).
 *
 * Per-tier monthly price + setup fee. Annual price derives from monthly per
 * spec §1 Q5 (monthly × 12); no separate annual input. Setup-fee default
 * reads `settings.get('billing.saas.monthly_setup_fee_cents')` on the
 * server and arrives here as a prop — no literal default inside an
 * autonomy-sensitive path per `project_settings_table_v1_architecture`.
 *
 * Popcorn-pricing reminder (`project_saas_popcorn_pricing`): medium is the
 * default, large needs a big jump in value, not just a big jump in price.
 * Inline copy nudges that when the large-vs-medium gap looks pure-price.
 *
 * Owner: SB-2b.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { houseSpring } from "@/lib/design-tokens";
import type { StepComponentProps } from "@/lib/wizards/step-types";

export type TierPriceState = {
  tierRank: 1 | 2 | 3;
  monthlyCents: number;
  setupFeeCents: number;
};

export type PricingStepState = {
  tiers: TierPriceState[];
};

export function emptyPricingState(defaultSetupFeeCents: number): PricingStepState {
  return {
    tiers: [1, 2, 3].map((rank) => ({
      tierRank: rank as 1 | 2 | 3,
      monthlyCents: 0,
      setupFeeCents: defaultSetupFeeCents,
    })),
  };
}

export function validatePricing(state: PricingStepState):
  | { ok: true }
  | { ok: false; reason: string } {
  if (state.tiers.length !== 3) {
    return { ok: false, reason: "Three tier prices required." };
  }
  for (const t of state.tiers) {
    if (!Number.isInteger(t.monthlyCents) || t.monthlyCents <= 0) {
      return {
        ok: false,
        reason: `Give tier ${t.tierRank} a monthly price above zero.`,
      };
    }
    if (!Number.isInteger(t.setupFeeCents) || t.setupFeeCents < 0) {
      return {
        ok: false,
        reason: `Setup fee can't be negative (tier ${t.tierRank}).`,
      };
    }
  }
  return { ok: true };
}

function formatDollars(cents: number): string {
  const v = (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
  return v;
}

export type PricingStepProps = StepComponentProps<PricingStepState> & {
  tierNames: Record<1 | 2 | 3, string>;
};

export function PricingStepClient({
  state,
  onChange,
  onNext,
  tierNames,
}: PricingStepProps) {
  const [error, setError] = React.useState<string | null>(null);
  const tiers = state.tiers;

  const patch = (rank: 1 | 2 | 3, p: Partial<TierPriceState>) => {
    onChange({
      tiers: tiers.map((t) => (t.tierRank === rank ? { ...t, ...p } : t)),
    });
  };

  // Popcorn-pricing nudge: when the large→medium ratio is small but setup
  // fees don't justify it, remind Andy that large needs a jump in *value*.
  const medium = tiers.find((t) => t.tierRank === 2);
  const large = tiers.find((t) => t.tierRank === 3);
  const popcornNudge =
    medium &&
    large &&
    medium.monthlyCents > 0 &&
    large.monthlyCents > 0 &&
    large.monthlyCents <= medium.monthlyCents * 1.2;

  const handleContinue = () => {
    const result = validatePricing({ tiers });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div className="space-y-5" data-wizard-step="saas-product-pricing">
      <p className="text-sm text-muted-foreground">
        Prices are cents-inclusive-of-GST. Monthly is the knob; annual-billed-
        monthly uses the same rate, and annual-upfront is monthly × 12.
      </p>

      <ul className="space-y-4">
        {tiers.map((t) => (
          <motion.li
            key={t.tierRank}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={houseSpring}
            className="rounded-md border border-border bg-card p-4"
            data-pricing-tier={t.tierRank}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                T{t.tierRank}
              </span>
              <span className="text-sm font-medium">
                {tierNames[t.tierRank]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Monthly (cents, inc-GST)
                </span>
                <Input
                  type="number"
                  min={0}
                  value={t.monthlyCents}
                  onChange={(e) =>
                    patch(t.tierRank, { monthlyCents: Number(e.target.value) })
                  }
                  aria-label={`Tier ${t.tierRank} monthly price in cents`}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Setup fee (cents, inc-GST)
                </span>
                <Input
                  type="number"
                  min={0}
                  value={t.setupFeeCents}
                  onChange={(e) =>
                    patch(t.tierRank, { setupFeeCents: Number(e.target.value) })
                  }
                  aria-label={`Tier ${t.tierRank} setup fee in cents`}
                />
              </label>
            </div>
            <p
              className="mt-3 text-xs text-muted-foreground"
              data-pricing-preview
            >
              Monthly {formatDollars(t.monthlyCents)} · Annual billed monthly{" "}
              {formatDollars(t.monthlyCents)} · Annual upfront{" "}
              {formatDollars(t.monthlyCents * 12)}
              {/* Annual upfront = monthly × 12 per spec §1 Q5. Structural. */}
            </p>
          </motion.li>
        ))}
      </ul>

      {popcornNudge ? (
        <p
          className="text-xs text-amber-600"
          data-popcorn-nudge
        >
          Large is only a small jump above medium — popcorn pricing calls for a
          real jump in value there, not just more dollars.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" data-wizard-field-error>
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
