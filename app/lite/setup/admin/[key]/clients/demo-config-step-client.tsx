"use client";

/**
 * `demo-config` step for saas-product-setup (SB-2b).
 *
 * Toggle `demo_enabled` + optional thin JSON payload (spec §8.2 permits
 * it to be empty for SB-2b). Shape locked to `{ sample_payload?: string }`
 * so the column stays addressable even before a consumer lands.
 *
 * Owner: SB-2b.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { StepComponentProps } from "@/lib/wizards/step-types";

export type DemoConfig = {
  sample_payload?: string;
};

export type DemoConfigStepState = {
  demoEnabled: boolean;
  config: DemoConfig;
};

export function emptyDemoConfigState(): DemoConfigStepState {
  return { demoEnabled: false, config: {} };
}

export function DemoConfigStepClient({
  state,
  onChange,
  onNext,
}: StepComponentProps<DemoConfigStepState>) {
  const setEnabled = (v: boolean) => onChange({ ...state, demoEnabled: v });
  const setSample = (v: string) =>
    onChange({
      ...state,
      config: v.trim() ? { sample_payload: v } : {},
    });

  return (
    <div className="space-y-5" data-wizard-step="saas-product-demo">
      <p className="text-sm text-muted-foreground">
        Demos let prospects try a slice of the product without subscribing.
        Optional — leave off until the in-product demo flow is ready.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.demoEnabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Demo enabled
      </label>

      {state.demoEnabled ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sample payload (optional)
          </span>
          <textarea
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={state.config.sample_payload ?? ""}
            onChange={(e) => setSample(e.target.value)}
            placeholder="Any seed data the demo should ship with."
          />
        </label>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}
