"use client";

/**
 * `usage-dimensions` step for saas-product-setup. 1–3 rows; each row has
 * a display-name input with an auto-derived snake_case key the admin can
 * override. House-spring entrance/exit per `feedback_motion_is_universal`.
 *
 * Owner: SB-2a.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { houseSpring } from "@/lib/design-tokens";
import type { StepComponentProps } from "@/lib/wizards/step-types";
import {
  MAX_DIMENSIONS,
  MIN_DIMENSIONS,
  suggestDimensionKey,
  validateDimensions,
  type SaasProductDimension,
} from "@/lib/wizards/defs/saas-product-setup";

export type DimensionsStepState = {
  dimensions: SaasProductDimension[];
};

let tempIdCounter = 0;
function newTempId(): string {
  tempIdCounter += 1;
  return `dim-${Date.now().toString(36)}-${tempIdCounter}`;
}

export function emptyDimensionsState(): DimensionsStepState {
  return {
    dimensions: [{ tempId: newTempId(), key: "", displayName: "" }],
  };
}

export function DimensionsStepClient({
  state,
  onChange,
  onNext,
}: StepComponentProps<DimensionsStepState>) {
  const [error, setError] = React.useState<string | null>(null);
  const dims = state.dimensions ?? [];

  const update = (tempId: string, patch: Partial<SaasProductDimension>) => {
    onChange({
      dimensions: dims.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)),
    });
  };

  const add = () => {
    if (dims.length >= MAX_DIMENSIONS) return;
    onChange({
      dimensions: [...dims, { tempId: newTempId(), key: "", displayName: "" }],
    });
  };

  const remove = (tempId: string) => {
    if (dims.length <= MIN_DIMENSIONS) return;
    onChange({ dimensions: dims.filter((d) => d.tempId !== tempId) });
  };

  const handleContinue = () => {
    const result = validateDimensions(dims);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    onNext();
  };

  return (
    <div className="space-y-5" data-wizard-step="saas-product-dimensions">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          A dimension is whatever you meter on — API calls, active campaigns,
          stored clips. Pick 1–3. You'll set per-tier limits next.
        </p>
      </div>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {dims.map((d, i) => (
            <motion.li
              key={d.tempId}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={houseSpring}
              className="rounded-md border border-border bg-card p-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1">
                  <label
                    htmlFor={`dim-name-${d.tempId}`}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Display name
                  </label>
                  <Input
                    id={`dim-name-${d.tempId}`}
                    value={d.displayName}
                    onChange={(e) => {
                      const displayName = e.target.value;
                      // Auto-suggest key while user hasn't overridden it.
                      const keyIsAutomatic =
                        d.key === "" || d.key === suggestDimensionKey(d.displayName);
                      update(d.tempId, {
                        displayName,
                        key: keyIsAutomatic ? suggestDimensionKey(displayName) : d.key,
                      });
                    }}
                    placeholder={i === 0 ? "API calls" : "Active campaigns"}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`dim-key-${d.tempId}`}
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Key
                  </label>
                  <Input
                    id={`dim-key-${d.tempId}`}
                    value={d.key}
                    onChange={(e) => update(d.tempId, { key: e.target.value })}
                    placeholder="api_calls"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => remove(d.tempId)}
                    disabled={dims.length <= MIN_DIMENSIONS}
                    aria-label={`Remove ${d.displayName || "dimension"}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={dims.length >= MAX_DIMENSIONS}
        >
          Add dimension
        </Button>
        <span className="text-xs text-muted-foreground">
          {dims.length} of {MAX_DIMENSIONS}
        </span>
      </div>

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
