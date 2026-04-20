"use client";

import * as React from "react";
import { WizardShell } from "@/components/lite/wizard-shell";
import type {
  WizardStepDefinition,
  WizardAudience,
} from "@/lib/wizards/types";
import type { PortfolioSignal } from "@/lib/hiring/portfolio";
import type { CelebrationCompleteResult } from "@/components/lite/wizard-steps/celebration-step";
import { useAdminShell, type StepStates } from "./use-admin-shell";
import {
  synthesizeRoleBriefAction,
  ingestPortfolioUrlAction,
  completeRoleBriefAction,
  type CompleteRoleBriefInput,
} from "../actions-hiring-role-brief";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Step state shapes
// ---------------------------------------------------------------------------

type RoleBasicsState = {
  roleName: string;
  engagementType: "contractor" | "employee";
  rateMinAud: string;
  rateMaxAud: string;
  targetHoursPerWeek: string;
  locationPrefCity: string;
  remoteOk: boolean;
  openCount: string;
};

type PortfolioEntry = {
  url: string;
  status: "idle" | "ingesting" | "done" | "error";
  signal: PortfolioSignal | null;
  error: string | null;
};

type ReferencePortfoliosState = {
  entries: PortfolioEntry[];
};

type SynthesisState = {
  status: "idle" | "running" | "done" | "error";
  styleSummary: string;
  extractedTags: string[];
  styleDoList: string[];
  styleAvoidList: string[];
  discoverySearchHints: string[];
  errorMessage: string | null;
  andyOverrides: string;
};

// ---------------------------------------------------------------------------
// Initial states
// ---------------------------------------------------------------------------

function initialStates(outroCopy: string): StepStates {
  return {
    "role-basics": {
      roleName: "",
      engagementType: "contractor",
      rateMinAud: "",
      rateMaxAud: "",
      targetHoursPerWeek: "",
      locationPrefCity: "",
      remoteOk: true,
      openCount: "1",
    } satisfies RoleBasicsState,
    "reference-portfolios": {
      entries: [
        { url: "", status: "idle", signal: null, error: null },
        { url: "", status: "idle", signal: null, error: null },
        { url: "", status: "idle", signal: null, error: null },
      ],
    } satisfies ReferencePortfoliosState,
    "llm-synthesis": {
      status: "idle",
      styleSummary: "",
      extractedTags: [],
      styleDoList: [],
      styleAvoidList: [],
      discoverySearchHints: [],
      errorMessage: null,
      andyOverrides: "",
    } satisfies SynthesisState,
    "confirm-open": { summary: [], confirmed: false },
    celebrate: { outroCopy, observatorySummary: null },
  };
}

// ---------------------------------------------------------------------------
// Step 1: Role Basics
// ---------------------------------------------------------------------------

function RoleBasicsStep({
  state,
  onChange,
  onNext,
}: {
  state: RoleBasicsState;
  onChange: (s: RoleBasicsState) => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!state.roleName.trim()) errs.roleName = "Give this role a name.";
    const min = state.rateMinAud ? Number(state.rateMinAud) : null;
    const max = state.rateMaxAud ? Number(state.rateMaxAud) : null;
    if (state.rateMinAud && (min === null || isNaN(min) || min < 0))
      errs.rateMinAud = "Enter a valid number.";
    if (state.rateMaxAud && (max === null || isNaN(max) || max < 0))
      errs.rateMaxAud = "Enter a valid number.";
    if (min != null && max != null && !isNaN(min) && !isNaN(max) && min > max)
      errs.rateMaxAud = "Max should be above min.";
    const hrs = state.targetHoursPerWeek ? Number(state.targetHoursPerWeek) : null;
    if (state.targetHoursPerWeek && (hrs === null || isNaN(hrs) || hrs <= 0))
      errs.targetHoursPerWeek = "Enter a valid number.";
    const oc = Number(state.openCount);
    if (isNaN(oc) || oc < 1) errs.openCount = "Need at least one slot.";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    onNext();
  };

  return (
    <form
      data-wizard-step="role-basics"
      className="mx-auto max-w-md space-y-4"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="rb-name">
          Role name
        </label>
        <Input
          id="rb-name"
          placeholder='e.g. "Video Editor — food / beverage"'
          value={state.roleName}
          onChange={(e) => onChange({ ...state, roleName: e.target.value })}
        />
        {errors.roleName && (
          <p className="text-xs text-destructive">{errors.roleName}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="rb-engagement">
          Engagement type
        </label>
        <select
          id="rb-engagement"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          value={state.engagementType}
          onChange={(e) =>
            onChange({
              ...state,
              engagementType: e.target.value as "contractor" | "employee",
            })
          }
        >
          <option value="contractor">Contractor</option>
          <option value="employee">Employee</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="rb-rate-min">
            Rate min (AUD/hr)
          </label>
          <Input
            id="rb-rate-min"
            type="number"
            min={0}
            placeholder="80"
            value={state.rateMinAud}
            onChange={(e) => onChange({ ...state, rateMinAud: e.target.value })}
          />
          {errors.rateMinAud && (
            <p className="text-xs text-destructive">{errors.rateMinAud}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="rb-rate-max">
            Rate max (AUD/hr)
          </label>
          <Input
            id="rb-rate-max"
            type="number"
            min={0}
            placeholder="120"
            value={state.rateMaxAud}
            onChange={(e) => onChange({ ...state, rateMaxAud: e.target.value })}
          />
          {errors.rateMaxAud && (
            <p className="text-xs text-destructive">{errors.rateMaxAud}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="rb-hours">
            Hours / week
          </label>
          <Input
            id="rb-hours"
            type="number"
            min={1}
            placeholder="10–20"
            value={state.targetHoursPerWeek}
            onChange={(e) =>
              onChange({ ...state, targetHoursPerWeek: e.target.value })
            }
          />
          {errors.targetHoursPerWeek && (
            <p className="text-xs text-destructive">
              {errors.targetHoursPerWeek}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="rb-slots">
            Slots to fill
          </label>
          <Input
            id="rb-slots"
            type="number"
            min={1}
            placeholder="1"
            value={state.openCount}
            onChange={(e) => onChange({ ...state, openCount: e.target.value })}
          />
          {errors.openCount && (
            <p className="text-xs text-destructive">{errors.openCount}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="rb-city">
          Location (city)
        </label>
        <Input
          id="rb-city"
          placeholder="Melbourne (or leave blank for any)"
          value={state.locationPrefCity}
          onChange={(e) =>
            onChange({ ...state, locationPrefCity: e.target.value })
          }
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.remoteOk}
          onChange={(e) => onChange({ ...state, remoteOk: e.target.checked })}
          className="h-4 w-4 rounded border-input"
        />
        Remote OK
      </label>

      <Button type="submit">Continue</Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Reference Portfolios
// ---------------------------------------------------------------------------

function ReferencePortfoliosStep({
  state,
  onChange,
  onNext,
}: {
  state: ReferencePortfoliosState;
  onChange: (s: ReferencePortfoliosState) => void;
  onNext: () => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const updateEntry = (idx: number, patch: Partial<PortfolioEntry>) => {
    const next = [...state.entries];
    next[idx] = { ...next[idx], ...patch };
    onChange({ entries: next });
  };

  const addRow = () => {
    if (state.entries.length >= 5) return;
    onChange({
      entries: [
        ...state.entries,
        { url: "", status: "idle", signal: null, error: null },
      ],
    });
  };

  const removeRow = (idx: number) => {
    if (state.entries.length <= 1) return;
    onChange({ entries: state.entries.filter((_, i) => i !== idx) });
  };

  const ingestUrl = async (idx: number) => {
    const entry = state.entries[idx];
    if (!entry.url.trim()) return;
    updateEntry(idx, { status: "ingesting", error: null });
    const result = await ingestPortfolioUrlAction(entry.url.trim());
    if (result.ok) {
      updateEntry(idx, { status: "done", signal: result.signal });
    } else {
      updateEntry(idx, { status: "error", error: result.reason });
    }
  };

  const handleContinue = () => {
    const filled = state.entries.filter((e) => e.url.trim().length > 0);
    if (filled.length === 0) {
      setError("Drop at least one reference URL.");
      return;
    }
    const pending = filled.filter(
      (e) => e.status === "idle" || e.status === "ingesting",
    );
    if (pending.length > 0) {
      setError("Wait for all URLs to finish processing.");
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div
      data-wizard-step="reference-portfolios"
      className="mx-auto max-w-md space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Drop 3–5 portfolio URLs — the people you&apos;d hire tomorrow. Vimeo,
        Behance, Dribbble, Instagram, personal sites — anything with work
        samples.
      </p>

      {state.entries.map((entry, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="flex-1 space-y-1">
            <Input
              placeholder="https://vimeo.com/..."
              value={entry.url}
              onChange={(e) => updateEntry(idx, { url: e.target.value })}
              disabled={entry.status === "ingesting"}
            />
            {entry.status === "done" && entry.signal && (
              <p className="text-xs text-muted-foreground">
                {entry.signal.platform} — {entry.signal.work_samples.length}{" "}
                sample{entry.signal.work_samples.length !== 1 ? "s" : ""}
              </p>
            )}
            {entry.status === "error" && entry.error && (
              <p className="text-xs text-destructive">{entry.error}</p>
            )}
          </div>
          {entry.status === "idle" && entry.url.trim() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void ingestUrl(idx)}
            >
              Fetch
            </Button>
          )}
          {entry.status === "ingesting" && (
            <span className="self-center text-xs text-muted-foreground">
              …
            </span>
          )}
          {entry.status === "done" && (
            <span className="self-center text-xs text-muted-foreground">
              Done
            </span>
          )}
          {state.entries.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeRow(idx)}
              aria-label="Remove URL"
            >
              ×
            </Button>
          )}
        </div>
      ))}

      {state.entries.length < 5 && (
        <Button type="button" variant="ghost" size="sm" onClick={addRow}>
          + Add another
        </Button>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button type="button" onClick={handleContinue}>
        Continue
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: LLM Synthesis
// ---------------------------------------------------------------------------

function SynthesisStep({
  synthesisState,
  basicsState,
  portfolioState,
  onChange,
  onNext,
}: {
  synthesisState: SynthesisState;
  basicsState: RoleBasicsState;
  portfolioState: ReferencePortfoliosState;
  onChange: (s: SynthesisState) => void;
  onNext: () => void;
}) {
  const runSynthesis = React.useCallback(async () => {
    onChange({ ...synthesisState, status: "running", errorMessage: null });

    const signals = portfolioState.entries
      .filter((e) => e.status === "done" && e.signal)
      .map((e) => e.signal!);

    const result = await synthesizeRoleBriefAction({
      roleName: basicsState.roleName,
      engagementType: basicsState.engagementType,
      rateMinAud: basicsState.rateMinAud ? Number(basicsState.rateMinAud) : null,
      rateMaxAud: basicsState.rateMaxAud ? Number(basicsState.rateMaxAud) : null,
      targetHoursPerWeek: basicsState.targetHoursPerWeek
        ? Number(basicsState.targetHoursPerWeek)
        : null,
      locationPrefCity: basicsState.locationPrefCity || null,
      remoteOk: basicsState.remoteOk,
      openCount: Number(basicsState.openCount) || 1,
      referenceSignals: signals,
    });

    if (result.ok) {
      onChange({
        ...synthesisState,
        status: "done",
        styleSummary: result.styleSummary,
        extractedTags: result.extractedTags,
        styleDoList: result.styleDoList,
        styleAvoidList: result.styleAvoidList,
        discoverySearchHints: result.discoverySearchHints,
        errorMessage: null,
      });
    } else {
      onChange({
        ...synthesisState,
        status: "error",
        errorMessage: result.reason,
      });
    }
  }, [synthesisState, basicsState, portfolioState, onChange]);

  React.useEffect(() => {
    if (synthesisState.status === "idle") {
      void runSynthesis();
    }
    // Only on mount / when status resets to idle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [synthesisState.status]);

  if (synthesisState.status === "running") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-sm text-muted-foreground">
          Reading your references and building the brief…
        </p>
      </div>
    );
  }

  if (synthesisState.status === "error") {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-xs text-destructive">
          {synthesisState.errorMessage}
        </p>
        <Button type="button" onClick={() => void runSynthesis()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div
      data-wizard-step="llm-synthesis"
      className="mx-auto max-w-lg space-y-5"
    >
      <div className="space-y-1">
        <label className="text-sm font-medium">Style summary</label>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={synthesisState.styleSummary}
          onChange={(e) =>
            onChange({ ...synthesisState, styleSummary: e.target.value })
          }
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Tags</label>
        <Input
          value={synthesisState.extractedTags.join(", ")}
          onChange={(e) =>
            onChange({
              ...synthesisState,
              extractedTags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
        <p className="text-xs text-muted-foreground">Comma-separated.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Style do&apos;s</label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={synthesisState.styleDoList.join("\n")}
          onChange={(e) =>
            onChange({
              ...synthesisState,
              styleDoList: e.target.value.split("\n").filter(Boolean),
            })
          }
        />
        <p className="text-xs text-muted-foreground">One per line.</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Discovery search hints</label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          value={synthesisState.discoverySearchHints.join("\n")}
          onChange={(e) =>
            onChange({
              ...synthesisState,
              discoverySearchHints: e.target.value.split("\n").filter(Boolean),
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          Search queries that would find similar work. One per line.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">
          Your overrides (optional)
        </label>
        <textarea
          className="flex min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          placeholder="Anything the synthesis missed or got wrong — free text."
          value={synthesisState.andyOverrides}
          onChange={(e) =>
            onChange({ ...synthesisState, andyOverrides: e.target.value })
          }
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({ ...synthesisState, status: "idle" })
          }
        >
          Re-synthesize
        </Button>
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review summary builder
// ---------------------------------------------------------------------------

function buildReviewSummary(states: StepStates) {
  const basics = states["role-basics"] as RoleBasicsState;
  const portfolios = states["reference-portfolios"] as ReferencePortfoliosState;
  const synthesis = states["llm-synthesis"] as SynthesisState;

  const rateRange =
    basics.rateMinAud && basics.rateMaxAud
      ? `$${basics.rateMinAud}–$${basics.rateMaxAud}/hr`
      : basics.rateMinAud
        ? `from $${basics.rateMinAud}/hr`
        : "not set";

  const refCount = portfolios.entries.filter(
    (e) => e.status === "done",
  ).length;

  return [
    { label: "Role", value: basics.roleName || "(unnamed)" },
    { label: "Type", value: basics.engagementType },
    { label: "Rate band", value: rateRange },
    {
      label: "Hours/week",
      value: basics.targetHoursPerWeek || "flexible",
    },
    {
      label: "Location",
      value:
        (basics.locationPrefCity || "any") +
        (basics.remoteOk ? " (remote OK)" : ""),
    },
    { label: "Slots", value: basics.openCount },
    {
      label: "References",
      value: `${refCount} portfolio${refCount !== 1 ? "s" : ""}`,
    },
    {
      label: "Tags",
      value: synthesis.extractedTags.join(", ") || "none",
    },
    {
      label: "Style summary",
      value:
        synthesis.styleSummary.length > 100
          ? synthesis.styleSummary.slice(0, 100) + "…"
          : synthesis.styleSummary || "(empty)",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main client
// ---------------------------------------------------------------------------

export type HiringRoleBriefClientProps = {
  audience: WizardAudience;
  steps: WizardStepDefinition[];
  outroCopy: string;
  expiryDays: number;
};

export function HiringRoleBriefClient({
  audience,
  steps,
  outroCopy,
  expiryDays,
}: HiringRoleBriefClientProps) {
  const {
    index,
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
    initialStates: initialStates(outroCopy),
  });

  React.useEffect(() => {
    if (step.type !== "review-and-confirm") return;
    setStates((prev) => {
      const next = buildReviewSummary(prev);
      const current = (
        prev["confirm-open"] as { summary?: unknown[] } | undefined
      )?.summary;
      if (
        Array.isArray(current) &&
        current.length === next.length &&
        current.every(
          (r, i) =>
            typeof r === "object" &&
            r !== null &&
            (r as { label?: string }).label === next[i].label &&
            (r as { value?: string }).value === next[i].value,
        )
      ) {
        return prev;
      }
      return {
        ...prev,
        "confirm-open": {
          ...(prev["confirm-open"] as object),
          summary: next,
        },
      };
    });
  }, [step.type, setStates]);

  const onComplete =
    React.useCallback(async (): Promise<CelebrationCompleteResult> => {
      const basics = states["role-basics"] as RoleBasicsState;
      const portfolios =
        states["reference-portfolios"] as ReferencePortfoliosState;
      const synthesis = states["llm-synthesis"] as SynthesisState;

      const input: CompleteRoleBriefInput = {
        roleName: basics.roleName.trim(),
        engagementType: basics.engagementType,
        rateMinAud: basics.rateMinAud ? Number(basics.rateMinAud) : null,
        rateMaxAud: basics.rateMaxAud ? Number(basics.rateMaxAud) : null,
        targetHoursPerWeek: basics.targetHoursPerWeek
          ? Number(basics.targetHoursPerWeek)
          : null,
        locationPrefCity: basics.locationPrefCity.trim() || null,
        remoteOk: basics.remoteOk,
        openCount: Number(basics.openCount) || 1,
        referenceUrls: portfolios.entries
          .filter((e) => e.url.trim())
          .map((e) => e.url.trim()),
        referenceSignals: portfolios.entries
          .filter((e) => e.signal != null)
          .map((e) => e.signal!),
        styleSummary: synthesis.styleSummary,
        extractedTags: synthesis.extractedTags,
        styleDoList: synthesis.styleDoList,
        styleAvoidList: synthesis.styleAvoidList,
        discoverySearchHints: synthesis.discoverySearchHints,
        andyOverrides: synthesis.andyOverrides.trim() || null,
      };

      return completeRoleBriefAction(input);
    }, [states]);

  const renderStep = (): React.ReactNode => {
    if (step.key === "role-basics") {
      return (
        <RoleBasicsStep
          state={stepState as RoleBasicsState}
          onChange={onStepStateChange as (s: RoleBasicsState) => void}
          onNext={advance}
        />
      );
    }
    if (step.key === "reference-portfolios") {
      return (
        <ReferencePortfoliosStep
          state={stepState as ReferencePortfoliosState}
          onChange={
            onStepStateChange as (s: ReferencePortfoliosState) => void
          }
          onNext={advance}
        />
      );
    }
    if (step.key === "llm-synthesis") {
      return (
        <SynthesisStep
          synthesisState={states["llm-synthesis"] as SynthesisState}
          basicsState={states["role-basics"] as RoleBasicsState}
          portfolioState={
            states["reference-portfolios"] as ReferencePortfoliosState
          }
          onChange={(s) =>
            setStates((prev) => ({ ...prev, "llm-synthesis": s }))
          }
          onNext={advance}
        />
      );
    }
    return null;
  };

  const isCustomStep =
    step.key === "role-basics" ||
    step.key === "reference-portfolios" ||
    step.key === "llm-synthesis";

  const configuredStep: WizardStepDefinition = React.useMemo(() => {
    if (step.type === "celebration") {
      return { ...step, config: { onDone, onComplete } };
    }
    return step;
  }, [step, onComplete, onDone]);

  if (isCustomStep) {
    return (
      <WizardShell
        wizardKey="hiring-role-brief"
        currentStep={index}
        stepLabels={steps.map((s) => s.label)}
        audience={audience}
        expiryDays={expiryDays}
        onCancel={handleCancel}
      >
        {renderStep()}
      </WizardShell>
    );
  }

  return (
    <WizardShell
      wizardKey="hiring-role-brief"
      currentStep={index}
      stepLabels={steps.map((s) => s.label)}
      audience={audience}
      expiryDays={expiryDays}
      onCancel={handleCancel}
      step={configuredStep}
      stepState={stepState}
      onStepStateChange={onStepStateChange}
      onNext={advance}
    />
  );
}
