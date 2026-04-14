/**
 * Public type surface for the setup-wizards primitive.
 * Owner: SW-1. Consumers: SW-2 (step library), SW-3 (vendor manifest +
 * registerIntegration), every WizardDefinition that ships across the app.
 *
 * Spec: docs/specs/setup-wizards.md §3.2, §3.3, §7.1.
 *
 * Intentionally framework-agnostic. The shell component + its React types
 * live in `components/lite/wizard-shell.tsx`. This file is pure TS so
 * tests, workers, and Server Actions can import it without pulling in React.
 */

import type { ActivityLogKind } from "@/lib/db/schema/activity-log";

export type WizardAudience = "admin" | "client";
export type WizardRenderMode = "slideover" | "dedicated-route";

/**
 * Step definitions are opaque to this type surface; SW-2 owns the concrete
 * discriminated union (`form`, `oauth-consent`, `api-key-paste`, etc.) per
 * spec §4. SW-1 declares the shape so definitions can be authored now and
 * the step runtime wired later without a breaking change.
 */
export type WizardStepType =
  | "form"
  | "oauth-consent"
  | "api-key-paste"
  | "webhook-probe"
  | "dns-verify"
  | "csv-import"
  | "async-check"
  | "content-picker"
  | "review-and-confirm"
  | "celebration"
  | "custom";

export type WizardStepDefinition = {
  key: string;
  type: WizardStepType;
  /** Human-readable label; shown in the progress bar on hover/tap. */
  label: string;
  /** Whether a user returning to an in-flight wizard can resume on this step. */
  resumable: boolean;
  /**
   * Step-type-specific configuration. SW-2 narrows this into a discriminated
   * union keyed on `type`; until then, the shell treats it as opaque.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: Record<string, any>;
};

/**
 * Completion-contract artefacts the shell verifies before marking a wizard
 * complete. See spec §3.3.
 */
export type CompletionArtefacts = {
  integrationConnections?: true;
  observatoryBands?: true;
  activityLog?: ActivityLogKind;
};

export type CompletionContract<TPayload> = {
  /** Keys that must be present in the final payload for the contract to pass. */
  required: (keyof TPayload)[];
  /** Live verification run against the real vendor / service. */
  verify: (
    payload: TPayload,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  artefacts: CompletionArtefacts;
};

/**
 * Observatory band seed. Declared here because every vendor manifest
 * registers at least one. SW-3 owns the `registerBands()` plumbing.
 */
export type VendorJobBand = {
  name: string;
  defaultBand: { p95: number; p99: number };
  unit: "ms" | "count" | "bytes" | "tokens" | "aud";
};

export type VendorManifest = {
  vendorKey: string;
  jobs: VendorJobBand[];
  actorConvention: "internal" | "external" | "prospect";
  killSwitchKey: string;
  humanDescription: string;
};

/**
 * Claim-a-sprinkle tab-title pool for wizards in flight. Keyed by phase
 * per spec §13.1. The shell rotates per tick; SW-1 stores the pool shape,
 * content-authoring landings populate the strings.
 */
export type TabTitlePool = {
  setup: string[];
  connecting: string[];
  confirming: string[];
  connected: string[];
  stuck: string[];
};

/**
 * Critical-flight capstone configuration. Only the admin first-run flight
 * declares one (per spec §8.3). All other wizards leave it undefined.
 */
export type CapstoneConfig = {
  /** One-time-per-account Tier-1 motion slot. */
  motionKey: string;
  /** Approved capstone copy (content-session owned). */
  line: string;
};

export type WizardVoiceTreatment = {
  introCopy: string | ((ctx: Record<string, unknown>) => string);
  outroCopy: string | ((ctx: Record<string, unknown>) => string);
  tabTitlePool: TabTitlePool;
  capstone?: CapstoneConfig;
};

/**
 * The canonical WizardDefinition. Every wizard (admin or client) exports one.
 * The shell reads these through `lib/wizards/registry.ts`.
 */
export type WizardDefinition<TCompletionPayload> = {
  key: string;
  audience: WizardAudience;
  renderMode: WizardRenderMode;
  steps: WizardStepDefinition[];
  completionContract: CompletionContract<TCompletionPayload>;
  vendorManifest?: VendorManifest;
  voiceTreatment: WizardVoiceTreatment;
};

/** Opaque erased form for the registry (completion payload type is lost on register). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyWizardDefinition = WizardDefinition<any>;
