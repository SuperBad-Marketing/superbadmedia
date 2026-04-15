"use client";

/**
 * `tiers` step for saas-product-setup (SB-2b).
 *
 * Three fixed rows per `project_saas_popcorn_pricing` — rank 1=small,
 * 2=medium, 3=large. Rows are NOT removable (rank is structural per
 * spec §8.2 + Q3); admin renames them + sets feature flags + per-dimension
 * limits.
 *
 * Feature flags: free-form `Record<string, boolean>` per brief. Admin adds
 * a named flag and toggles it; keep it sparse until a consuming feature
 * prescribes a starter set (spec §8.2 lets it be empty for SB-2b).
 *
 * Limits: one row per dimension declared in step 2. `limit_value = null`
 * (∞ checked) = unlimited per `project_tier_limits_protect_margin`.
 *
 * Owner: SB-2b.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { houseSpring } from "@/lib/design-tokens";
import type { StepComponentProps } from "@/lib/wizards/step-types";
import type { SaasProductDimension } from "@/lib/wizards/defs/saas-product-setup";

export type TierLimitState = {
  /** Finite cap; ignored when `unlimited` is true. */
  value: number;
  unlimited: boolean;
};

export type TierRowState = {
  /** Structural rank — 1=small, 2=medium, 3=large. Not editable. */
  tierRank: 1 | 2 | 3;
  name: string;
  featureFlags: Record<string, boolean>;
  /** Keyed by dimension `tempId` from step 2's state bag. */
  limits: Record<string, TierLimitState>;
};

export type TiersStepState = {
  tiers: TierRowState[];
};

const DEFAULT_TIER_NAMES: Record<1 | 2 | 3, string> = {
  1: "Small",
  2: "Medium",
  3: "Large",
};

export function emptyTiersState(): TiersStepState {
  return {
    tiers: [1, 2, 3].map((rank) => ({
      tierRank: rank as 1 | 2 | 3,
      name: DEFAULT_TIER_NAMES[rank as 1 | 2 | 3],
      featureFlags: {},
      limits: {},
    })),
  };
}

/** Sync the `limits` keys to the current dimensions list. */
export function reconcileTierLimits(
  tiers: TierRowState[],
  dimensions: SaasProductDimension[],
): TierRowState[] {
  return tiers.map((t) => {
    const next: Record<string, TierLimitState> = {};
    for (const d of dimensions) {
      next[d.tempId] =
        t.limits[d.tempId] ?? { value: 0, unlimited: false };
    }
    return { ...t, limits: next };
  });
}

export function validateTiers(state: TiersStepState):
  | { ok: true }
  | { ok: false; reason: string } {
  if (state.tiers.length !== 3) {
    return { ok: false, reason: "Three tiers required." };
  }
  for (const t of state.tiers) {
    if (!t.name.trim()) {
      return { ok: false, reason: `Give every tier a name (tier ${t.tierRank}).` };
    }
    for (const k of Object.keys(t.limits)) {
      const lim = t.limits[k];
      if (!lim.unlimited && (!Number.isFinite(lim.value) || lim.value < 0)) {
        return {
          ok: false,
          reason: "Limits must be zero or positive, or unlimited.",
        };
      }
    }
  }
  return { ok: true };
}

export type TierEditorStepProps = StepComponentProps<TiersStepState> & {
  dimensions: SaasProductDimension[];
};

export function TierEditorStepClient({
  state,
  onChange,
  onNext,
  dimensions,
}: TierEditorStepProps) {
  const [error, setError] = React.useState<string | null>(null);
  const tiers = state.tiers;

  // Keep limit rows in sync if dimensions change underneath us.
  React.useEffect(() => {
    const reconciled = reconcileTierLimits(tiers, dimensions);
    const needsWrite = reconciled.some(
      (t, i) =>
        Object.keys(t.limits).length !== Object.keys(tiers[i].limits).length ||
        Object.keys(t.limits).some((k) => !(k in tiers[i].limits)),
    );
    if (needsWrite) onChange({ tiers: reconciled });
  }, [dimensions, tiers, onChange]);

  const patchTier = (rank: 1 | 2 | 3, patch: Partial<TierRowState>) => {
    onChange({
      tiers: tiers.map((t) => (t.tierRank === rank ? { ...t, ...patch } : t)),
    });
  };

  const patchLimit = (
    rank: 1 | 2 | 3,
    dimId: string,
    patch: Partial<TierLimitState>,
  ) => {
    onChange({
      tiers: tiers.map((t) =>
        t.tierRank === rank
          ? {
              ...t,
              limits: {
                ...t.limits,
                [dimId]: { ...t.limits[dimId], ...patch },
              },
            }
          : t,
      ),
    });
  };

  const addFlag = (rank: 1 | 2 | 3, key: string) => {
    const k = key.trim();
    if (!k) return;
    patchTier(rank, {
      featureFlags: {
        ...tiers.find((t) => t.tierRank === rank)!.featureFlags,
        [k]: true,
      },
    });
  };

  const removeFlag = (rank: 1 | 2 | 3, key: string) => {
    const flags = {
      ...tiers.find((t) => t.tierRank === rank)!.featureFlags,
    };
    delete flags[key];
    patchTier(rank, { featureFlags: flags });
  };

  const toggleFlag = (rank: 1 | 2 | 3, key: string) => {
    const tier = tiers.find((t) => t.tierRank === rank)!;
    patchTier(rank, {
      featureFlags: { ...tier.featureFlags, [key]: !tier.featureFlags[key] },
    });
  };

  const handleContinue = () => {
    const result = validateTiers({ tiers });
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div className="space-y-5" data-wizard-step="saas-product-tiers">
      <p className="text-sm text-muted-foreground">
        Three tiers: small captures, medium sells, large swings. Medium is the
        default; large needs a big jump in value (not just price) per the
        popcorn pricing rule.
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
            data-tier-rank={t.tierRank}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
                T{t.tierRank}
              </span>
              <Input
                aria-label={`Tier ${t.tierRank} name`}
                value={t.name}
                onChange={(e) => patchTier(t.tierRank, { name: e.target.value })}
                className="max-w-sm"
              />
            </div>

            {dimensions.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Limits
                </p>
                <ul className="space-y-2">
                  {dimensions.map((d) => {
                    const lim =
                      t.limits[d.tempId] ?? { value: 0, unlimited: false };
                    return (
                      <li
                        key={d.tempId}
                        className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_auto]"
                      >
                        <span className="text-sm">
                          {d.displayName || d.key}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          aria-label={`${d.displayName || d.key} limit for tier ${t.tierRank}`}
                          value={lim.unlimited ? "" : lim.value}
                          disabled={lim.unlimited}
                          onChange={(e) =>
                            patchLimit(t.tierRank, d.tempId, {
                              value: Number(e.target.value),
                            })
                          }
                          className="w-28"
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={lim.unlimited}
                            onChange={(e) =>
                              patchLimit(t.tierRank, d.tempId, {
                                unlimited: e.target.checked,
                              })
                            }
                          />
                          ∞ Unlimited
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <FeatureFlagsEditor
              flags={t.featureFlags}
              onAdd={(k) => addFlag(t.tierRank, k)}
              onToggle={(k) => toggleFlag(t.tierRank, k)}
              onRemove={(k) => removeFlag(t.tierRank, k)}
            />
          </motion.li>
        ))}
      </ul>

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

function FeatureFlagsEditor({
  flags,
  onAdd,
  onToggle,
  onRemove,
}: {
  flags: Record<string, boolean>;
  onAdd: (key: string) => void;
  onToggle: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const [draft, setDraft] = React.useState("");
  const keys = Object.keys(flags);

  const add = () => {
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Feature flags
      </p>
      <AnimatePresence initial={false}>
        {keys.map((k) => (
          <motion.div
            key={k}
            layout
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={houseSpring}
            className="flex items-center gap-3 text-sm"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={flags[k]}
                onChange={() => onToggle(k)}
              />
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {k}
              </code>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(k)}
              aria-label={`Remove flag ${k}`}
            >
              Remove
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        <Input
          placeholder="flag_key"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-w-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!draft.trim()}
        >
          Add flag
        </Button>
      </div>
    </div>
  );
}
