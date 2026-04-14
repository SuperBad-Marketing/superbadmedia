"use client";

/**
 * `form` step-type — schema-validated form primitive.
 * Config: `{ schema: z.ZodObject }` for the field set; fields are rendered
 * generically from the schema shape. Complex forms use the `custom` escape.
 */

import * as React from "react";
import type { z, ZodRawShape } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type FormStepState = {
  values: Record<string, string>;
};

export type FormStepConfig = {
  schema: z.ZodObject<ZodRawShape>;
};

function FormStepComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<FormStepState>) {
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const cfg = config as FormStepConfig | undefined;
  const shape = cfg?.schema?.shape ?? {};
  const fieldKeys = Object.keys(shape);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg?.schema) {
      onNext();
      return;
    }
    const result = cfg.schema.safeParse(state.values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onNext();
  };

  return (
    <form data-wizard-step="form" className="space-y-4" onSubmit={handleSubmit}>
      {fieldKeys.map((key) => (
        <div key={key} className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`field-${key}`}>
            {key}
          </label>
          <Input
            id={`field-${key}`}
            value={state.values[key] ?? ""}
            onChange={(e) =>
              onChange({ values: { ...state.values, [key]: e.target.value } })
            }
          />
          {errors[key] ? (
            <p className="text-xs text-destructive" data-wizard-field-error>
              {errors[key]}
            </p>
          ) : null}
        </div>
      ))}
      <Button type="submit">Continue</Button>
    </form>
  );
}

export const formStep: StepTypeDefinition<FormStepState> = {
  type: "form",
  resumableByDefault: true,
  Component: FormStepComponent,
  resume: (raw) => ({
    values:
      raw && typeof raw === "object" && "values" in raw
        ? (((raw as { values: unknown }).values as Record<string, string>) ?? {})
        : {},
  }),
  validate: (state) =>
    state &&
    state.values &&
    typeof state.values === "object" &&
    !Array.isArray(state.values)
      ? { ok: true }
      : invalid("Form state is missing values."),
};
