"use client";

/**
 * saas-product-setup per-wizard client (SB-2a slice).
 *
 * Steps driven locally:
 *   1. `name-and-slug` (form step, Zod-validated) — live slug uniqueness
 *      check via `checkSaasProductSlugAction`.
 *   2. `usage-dimensions` (custom step) — 1–3 rows, house-spring motion.
 *      On Continue: calls `persistSaasProductDraftAction` → on success,
 *      stores the new productId and advances to step 3 (stub).
 *   3. `tiers` (custom step, stub) — "Coming in SB-2b".
 *   4. `pricing` (custom step, stub) — "Coming in SB-2b".
 *   5. `demo-config` (custom step, stub) — "Coming in SB-2b".
 *   6. `review` (review-and-confirm, stub) — renders nothing meaningful.
 *   7. `celebrate` — unreachable until SB-2b.
 *
 * Owner: SB-2a.
 */
import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import type { StepComponentProps } from "@/lib/wizards/step-types";
import {
  suggestSlugFromName,
  type SaasProductSetupPayload,
} from "@/lib/wizards/defs/saas-product-setup";
import {
  checkSaasProductSlugAction,
  persistSaasProductDraftAction,
} from "../actions-saas-product";
import {
  DimensionsStepClient,
  emptyDimensionsState,
  type DimensionsStepState,
} from "./dimensions-step-client";
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
};

function initialStates(outroCopy: string): StepStates {
  return {
    "name-and-slug": {
      values: { name: "", description: "", slug: "" },
    } satisfies NameSlugFormState,
    "usage-dimensions": emptyDimensionsState(),
    tiers: {},
    pricing: {},
    "demo-config": {},
    review: {},
    celebrate: { outroCopy, observatorySummary: null },
    __draft: { productId: null } satisfies SaasDraftState,
  };
}

function ComingInSb2bStep({ stepKey }: StepComponentProps<unknown>) {
  return (
    <div
      data-wizard-step={`stub-${stepKey}`}
      className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground"
    >
      Coming in SB-2b.
    </div>
  );
}

export function SaasProductSetupClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: SaasProductSetupClientProps) {
  const {
    index,
    step,
    states,
    setStates,
    stepState,
    onStepStateChange,
    advance,
    handleCancel,
  } = useAdminShell({ steps, initialStates: initialStates(outroCopy) });

  const [slugError, setSlugError] = React.useState<string | null>(null);
  const [persistError, setPersistError] = React.useState<string | null>(null);
  const [persisting, setPersisting] = React.useState(false);

  // Auto-suggest slug while the user hasn't manually overridden it.
  React.useEffect(() => {
    if (step.key !== "name-and-slug") return;
    const current = states["name-and-slug"] as NameSlugFormState;
    const suggestion = suggestSlugFromName(current.values.name);
    if (
      current.values.name.length > 0 &&
      current.values.slug === "" &&
      suggestion.length >= 2
    ) {
      setStates((prev) => {
        const s = prev["name-and-slug"] as NameSlugFormState;
        return {
          ...prev,
          "name-and-slug": {
            values: { ...s.values, slug: suggestion },
          },
        };
      });
    }
  }, [states, step.key, setStates]);

  const handleNameSlugAdvance = React.useCallback(async () => {
    setSlugError(null);
    const form = states["name-and-slug"] as NameSlugFormState;
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
      const form = states["name-and-slug"] as NameSlugFormState;
      const dimsState = states["usage-dimensions"] as DimensionsStepState;
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

  // Compose the step with type-specific behaviour.
  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.key === "usage-dimensions") {
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
    if (
      step.key === "tiers" ||
      step.key === "pricing" ||
      step.key === "demo-config"
    ) {
      return {
        ...step,
        config: {
          render: (props: StepComponentProps<unknown>) => (
            <ComingInSb2bStep {...props} />
          ),
        },
      };
    }
    return step;
  }, [step, handleDimensionsAdvance, persistError, persisting, stepState]);

  const customOnNext =
    step.key === "name-and-slug" ? handleNameSlugAdvance : advance;

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
      {step.key === "name-and-slug" && slugError ? (
        <p className="mt-2 text-sm text-destructive" data-wizard-field-error>
          {slugError}
        </p>
      ) : null}
    </WizardShell>
  );
}

// Silence unused-payload-type warning — kept for SB-2b's publish action.
export type _SB2bPayloadAlias = SaasProductSetupPayload;
