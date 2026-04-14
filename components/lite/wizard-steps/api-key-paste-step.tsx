"use client";

/**
 * `api-key-paste` step-type — single API-key paste + test-call verification.
 * Shows the key's last 4 characters masked-on-save after a successful test.
 * Actual vault/crypto is B2's; this primitive hands the key to the wizard
 * definition's `testCall(key)` and stores the masked prefix in state.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type ApiKeyPasteState = {
  key: string;
  verified: boolean;
  maskedSuffix: string | null;
  error: string | null;
};

export type ApiKeyPasteConfig = {
  label: string;
  testCall: (key: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

function mask(key: string): string {
  const tail = key.slice(-4);
  return `••••${tail}`;
}

function ApiKeyPasteComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<ApiKeyPasteState>) {
  const cfg = config as ApiKeyPasteConfig | undefined;
  const [testing, setTesting] = React.useState(false);

  const runTest = async () => {
    if (!cfg?.testCall) return;
    setTesting(true);
    try {
      const result = await cfg.testCall(state.key);
      if (result.ok) {
        onChange({
          ...state,
          verified: true,
          maskedSuffix: mask(state.key),
          error: null,
        });
      } else {
        onChange({ ...state, verified: false, error: result.reason });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div data-wizard-step="api-key-paste" className="space-y-4">
      <label className="space-y-1 block">
        <span className="text-sm font-medium">{cfg?.label ?? "API key"}</span>
        {state.verified && state.maskedSuffix ? (
          <p
            className="text-sm font-mono text-muted-foreground"
            data-wizard-api-key-masked
          >
            {state.maskedSuffix}
          </p>
        ) : (
          <Input
            type="password"
            autoComplete="off"
            value={state.key}
            onChange={(e) =>
              onChange({ ...state, key: e.target.value, verified: false, error: null })
            }
          />
        )}
      </label>
      {state.error ? (
        <p className="text-xs text-destructive" data-wizard-api-key-error>
          {state.error}
        </p>
      ) : null}
      {state.verified ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : (
        <Button type="button" onClick={runTest} disabled={!state.key || testing}>
          {testing ? "Testing…" : "Test key"}
        </Button>
      )}
    </div>
  );
}

export const apiKeyPasteStep: StepTypeDefinition<ApiKeyPasteState> = {
  type: "api-key-paste",
  resumableByDefault: true,
  Component: ApiKeyPasteComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<ApiKeyPasteState>;
    return {
      key: typeof r.key === "string" ? r.key : "",
      verified: Boolean(r.verified),
      maskedSuffix:
        typeof r.maskedSuffix === "string" ? r.maskedSuffix : null,
      error: typeof r.error === "string" ? r.error : null,
    };
  },
  validate: (state) =>
    state.verified ? { ok: true } : invalid("That key hasn&apos;t been tested yet."),
};
