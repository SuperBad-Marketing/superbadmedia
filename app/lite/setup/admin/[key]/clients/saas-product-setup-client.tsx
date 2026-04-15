"use client";

/**
 * saas-product-setup per-wizard client (SB-2b).
 *
 * Full wizard arc:
 *   1. `name-and-slug` — form step, Zod-validated; slug uniqueness via
 *      `checkSaasProductSlugAction`.
 *   2. `usage-dimensions` — 1–3 rows; on Continue, persist draft via
 *      `persistSaasProductDraftAction` and stash `productId`.
 *   3. `tiers` — three fixed rows (rank 1/2/3 = small/medium/large) per
 *      `project_saas_popcorn_pricing`; feature-flag toggles + per-dimension
 *      limits with ∞ support.
 *   4. `pricing` — per-tier monthly + setup fee (default sourced from
 *      `settings.get('billing.saas.monthly_setup_fee_cents')`) + live
 *      annual-upfront preview (monthly × 12 per spec §1 Q5).
 *   5. `demo-config` — demo toggle + thin JSON payload.
 *   6. `review` — full summary, per-section Edit buttons jump back to the
 *      originating step.
 *   7. `celebrate` — fires `publishSaasProductAction` on mount;
 *      subscription-activated sound on success (8-sound registry).
 *
 * Resume integrity: steps 3+ check `__draft.productId` — if missing
 * (e.g. resumed past expiry) the user is bounced back to step 2.
 *
 * Owner: SB-2b.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import { Button } from "@/components/ui/button";
import { useSound } from "@/components/lite/sound-provider";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import type { StepComponentProps } from "@/lib/wizards/step-types";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import {
  suggestSlugFromName,
  type SaasProductSetupPayload,
} from "@/lib/wizards/defs/saas-product-setup";
import {
  checkSaasProductSlugAction,
  persistSaasProductDraftAction,
  publishSaasProductAction,
  type PublishSaasProductInput,
} from "../actions-saas-product";
import {
  DimensionsStepClient,
  emptyDimensionsState,
  type DimensionsStepState,
} from "./dimensions-step-client";
import {
  TierEditorStepClient,
  emptyTiersState,
  type TiersStepState,
} from "./tier-editor-step-client";
import {
  PricingStepClient,
  emptyPricingState,
  type PricingStepState,
} from "./pricing-step-client";
import {
  DemoConfigStepClient,
  emptyDemoConfigState,
  type DemoConfigStepState,
} from "./demo-config-step-client";
import { useAdminShell, type StepStates } from "./use-admin-shell";

type NameSlugFormState = {
  values: {
    name: string;
    description: string;
    slug: string;
  };
};

type SaasDraftState = {
  productId: string | null;
};

export type SaasProductSetupClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
  setupFeeCentsDefault: number;
};

const STEP_KEYS = {
  nameSlug: "name-and-slug",
  dimensions: "usage-dimensions",
  tiers: "tiers",
  pricing: "pricing",
  demo: "demo-config",
  review: "review",
  celebrate: "celebrate",
} as const;

function initialStates(
  outroCopy: string,
  setupFeeCentsDefault: number,
): StepStates {
  return {
    [STEP_KEYS.nameSlug]: {
      values: { name: "", description: "", slug: "" },
    } satisfies NameSlugFormState,
    [STEP_KEYS.dimensions]: emptyDimensionsState(),
    [STEP_KEYS.tiers]: emptyTiersState(),
    [STEP_KEYS.pricing]: emptyPricingState(setupFeeCentsDefault),
    [STEP_KEYS.demo]: emptyDemoConfigState(),
    [STEP_KEYS.review]: { confirmed: false },
    [STEP_KEYS.celebrate]: { outroCopy, observatorySummary: null },
    __draft: { productId: null } satisfies SaasDraftState,
  };
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
}

export function SaasProductSetupClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
  setupFeeCentsDefault,
}: SaasProductSetupClientProps) {
  const {
    index,
    setIndex,
    step,
    states,
    setStates,
    stepState,
    onStepStateChange,
    advance,
    handleCancel,
    onDone,
  } = useAdminShell({
    steps,
    initialStates: initialStates(outroCopy, setupFeeCentsDefault),
  });

  const { play } = useSound();

  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [persistError, setPersistError] = React.useState<string | null>(null);
  const [persisting, setPersisting] = React.useState(false);

  // Resume guard — any step past dimensions requires a persisted productId.
  React.useEffect(() => {
    const draft = states.__draft as SaasDraftState;
    if (!draft.productId && index >= 2) {
      setIndex(1);
    }
  }, [index, states, setIndex]);

  // Auto-suggest slug while the user hasn't manually overridden it.
  React.useEffect(() => {
    if (step.key !== STEP_KEYS.nameSlug) return;
    const current = states[STEP_KEYS.nameSlug] as NameSlugFormState;
    const suggestion = suggestSlugFromName(current.values.name);
    if (
      current.values.name.length > 0 &&
      current.values.slug === "" &&
      suggestion.length >= 2
    ) {
      setStates((prev) => {
        const s = prev[STEP_KEYS.nameSlug] as NameSlugFormState;
        return {
          ...prev,
          [STEP_KEYS.nameSlug]: {
            values: { ...s.values, slug: suggestion },
          },
        };
      });
    }
  }, [states, step.key, setStates]);

  const handleNameSlugAdvance = React.useCallback(async () => {
    setSlugError(null);
    const form = states[STEP_KEYS.nameSlug] as NameSlugFormState;
    const result = await checkSaasProductSlugAction(form.values.slug);
    if (!result.ok) {
      setSlugError(result.reason);
      return;
    }
    advance();
  }, [states, advance]);

  const handleDimensionsAdvance = React.useCallback(async () => {
    if (persisting) return;
    setPersistError(null);
    setPersisting(true);
    try {
      const form = states[STEP_KEYS.nameSlug] as NameSlugFormState;
      const dimsState = states[STEP_KEYS.dimensions] as DimensionsStepState;
      const result = await persistSaasProductDraftAction({
        name: form.values.name,
        description:
          form.values.description.trim().length > 0
            ? form.values.description.trim()
            : null,
        slug: form.values.slug,
        dimensions: dimsState.dimensions.map((d) => ({
          key: d.key,
          displayName: d.displayName,
        })),
      });
      if (!result.ok) {
        setPersistError(result.reason);
        return;
      }
      setStates((prev) => ({
        ...prev,
        __draft: { productId: result.productId },
      }));
      advance();
    } finally {
      setPersisting(false);
    }
  }, [states, advance, persisting, setStates]);

  // Publish orchestrator — runs on celebration-step mount.
  const runPublish = React.useCallback(async (): Promise<CelebrationCompleteResult> => {
    const draft = states.__draft as SaasDraftState;
    if (!draft.productId) {
      return { ok: false, reason: "Missing product draft — restart the wizard." };
    }
    const tiersState = states[STEP_KEYS.tiers] as TiersStepState;
    const pricingState = states[STEP_KEYS.pricing] as PricingStepState;
    const demoState = states[STEP_KEYS.demo] as DemoConfigStepState;
    const dimsState = states[STEP_KEYS.dimensions] as DimensionsStepState;

    const input: PublishSaasProductInput = {
      productId: draft.productId,
      tiers: tiersState.tiers.map((t) => {
        const price = pricingState.tiers.find((p) => p.tierRank === t.tierRank)!;
        return {
          tierRank: t.tierRank,
          name: t.name,
          monthlyCents: price.monthlyCents,
          setupFeeCents: price.setupFeeCents,
          featureFlags: t.featureFlags,
          limits: dimsState.dimensions.map((d) => {
            const lim = t.limits[d.tempId] ?? { value: 0, unlimited: false };
            return {
              dimensionKey: d.key,
              value: lim.unlimited ? null : lim.value,
            };
          }),
        };
      }),
      demo: { enabled: demoState.demoEnabled, config: demoState.config },
    };

    const result = await publishSaasProductAction(input);
    if (result.ok) {
      play("subscription-activated");
      return { ok: true, observatorySummary: result.observatorySummary };
    }
    return { ok: false, reason: result.reason };
  }, [states, play]);

  const reviewRows = React.useMemo(() => {
    const form = states[STEP_KEYS.nameSlug] as NameSlugFormState;
    const dims = states[STEP_KEYS.dimensions] as DimensionsStepState;
    const tiers = states[STEP_KEYS.tiers] as TiersStepState;
    const pricing = states[STEP_KEYS.pricing] as PricingStepState;
    const demo = states[STEP_KEYS.demo] as DemoConfigStepState;
    const sectionIndex = (key: string) =>
      steps.findIndex((s) => s.key === key);
    return [
      {
        title: "Product",
        editIndex: sectionIndex(STEP_KEYS.nameSlug),
        rows: [
          { label: "Name", value: form.values.name },
          { label: "Slug", value: form.values.slug },
          {
            label: "Description",
            value: form.values.description || "—",
          },
        ],
      },
      {
        title: "Dimensions",
        editIndex: sectionIndex(STEP_KEYS.dimensions),
        rows: dims.dimensions.map((d) => ({
          label: d.displayName || d.key,
          value: d.key,
        })),
      },
      {
        title: "Tiers",
        editIndex: sectionIndex(STEP_KEYS.tiers),
        rows: tiers.tiers.map((t) => {
          const price = pricing.tiers.find((p) => p.tierRank === t.tierRank);
          const priceLine = price
            ? ` — ${formatDollars(price.monthlyCents)}/mo`
            : "";
          const flagCount = Object.keys(t.featureFlags).filter(
            (k) => t.featureFlags[k],
          ).length;
          return {
            label: `T${t.tierRank} ${t.name}`,
            value: `${priceLine}${flagCount ? ` · ${flagCount} flag${flagCount === 1 ? "" : "s"}` : ""}`,
          };
        }),
      },
      {
        title: "Demo",
        editIndex: sectionIndex(STEP_KEYS.demo),
        rows: [
          {
            label: "Enabled",
            value: demo.demoEnabled ? "Yes" : "No",
          },
        ],
      },
    ];
  }, [states, steps]);

  const dimensionsForTiers = (
    states[STEP_KEYS.dimensions] as DimensionsStepState
  ).dimensions;
  const tierNames: Record<1 | 2 | 3, string> = React.useMemo(() => {
    const s = states[STEP_KEYS.tiers] as TiersStepState;
    return {
      1: s.tiers.find((t) => t.tierRank === 1)?.name ?? "Small",
      2: s.tiers.find((t) => t.tierRank === 2)?.name ?? "Medium",
      3: s.tiers.find((t) => t.tierRank === 3)?.name ?? "Large",
    };
  }, [states]);

  // Compose the step with type-specific behaviour.
  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.key === STEP_KEYS.dimensions) {
      const current = stepState as DimensionsStepState;
      return {
        ...step,
        config: {
          render: (props: StepComponentProps<DimensionsStepState>) => (
            <div className="space-y-3">
              <DimensionsStepClient
                {...props}
                onNext={handleDimensionsAdvance}
                state={current}
              />
              {persistError ? (
                <p className="text-sm text-destructive" data-wizard-field-error>
                  {persistError}
                </p>
              ) : null}
              {persisting ? (
                <p className="text-xs text-muted-foreground">Saving draft…</p>
              ) : null}
            </div>
          ),
        },
      };
    }
    if (step.key === STEP_KEYS.tiers) {
      return {
        ...step,
        config: {
          render: (props: StepComponentProps<TiersStepState>) => (
            <TierEditorStepClient {...props} dimensions={dimensionsForTiers} />
          ),
        },
      };
    }
    if (step.key === STEP_KEYS.pricing) {
      return {
        ...step,
        config: {
          render: (props: StepComponentProps<PricingStepState>) => (
            <PricingStepClient {...props} tierNames={tierNames} />
          ),
        },
      };
    }
    if (step.key === STEP_KEYS.demo) {
      return {
        ...step,
        config: {
          render: (props: StepComponentProps<DemoConfigStepState>) => (
            <DemoConfigStepClient {...props} />
          ),
        },
      };
    }
    if (step.key === STEP_KEYS.celebrate) {
      return {
        ...step,
        config: {
          onDone,
          onComplete: runPublish,
        },
      };
    }
    return step;
  }, [
    step,
    stepState,
    handleDimensionsAdvance,
    persistError,
    persisting,
    dimensionsForTiers,
    tierNames,
    runPublish,
    onDone,
  ]);

  const customOnNext =
    step.key === STEP_KEYS.nameSlug ? handleNameSlugAdvance : advance;

  // Review step bypasses the registry so we can render per-section Edit
  // buttons. Pass via `children`; do not hand a `step` to the shell in
  // this branch.
  if (step.key === STEP_KEYS.review) {
    return (
      <WizardShell
        wizardKey="saas-product-setup"
        currentStep={index}
        stepLabels={steps.map((s) => s.label)}
        audience={audience}
        expiryDays={expiryDays}
        onCancel={handleCancel}
      >
        <div className="space-y-6" data-wizard-step="review-and-confirm">
          {reviewRows.map((section) => (
            <section key={section.title} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                {section.editIndex >= 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIndex(section.editIndex)}
                    data-wizard-review-edit
                    data-edit-target={section.title}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm">
                {section.rows.map((row, i) => (
                  <React.Fragment key={i}>
                    <dt className="text-muted-foreground">{row.label}</dt>
                    <dd>{row.value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          ))}
          <Button type="button" onClick={advance}>
            Publish
          </Button>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      wizardKey="saas-product-setup"
      currentStep={index}
      stepLabels={steps.map((s) => s.label)}
      audience={audience}
      expiryDays={expiryDays}
      onCancel={handleCancel}
      step={configuredStep}
      stepState={stepState}
      onStepStateChange={onStepStateChange}
      onNext={customOnNext}
    >
      {step.key === STEP_KEYS.nameSlug && slugError ? (
        <p className="mt-2 text-sm text-destructive" data-wizard-field-error>
          {slugError}
        </p>
      ) : null}
    </WizardShell>
  );
}

// Silence unused-payload-type warning — kept for downstream consumers.
export type _SB2bPayloadAlias = SaasProductSetupPayload;
