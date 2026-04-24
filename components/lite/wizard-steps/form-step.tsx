"use client";

/**
 * `form` step-type — schema-validated form primitive.
 * Config: `{ schema: z.ZodObject }` for the field set; fields are rendered
 * generically from the schema shape. Complex forms use the `custom` escape.
 */

import * as React from "react";
import type { z, ZodRawShape } from "zod";
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

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

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
    <form data-wizard-step="form" className="space-y-5" onSubmit={handleSubmit}>
      {fieldKeys.map((key) => (
        <div key={key} className="space-y-1.5">
          <label
            className="block text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-brand-cream)", fontFamily: "var(--font-label)" }}
            htmlFor={`field-${key}`}
          >
            {humanizeKey(key)}
          </label>
          <input
            id={`field-${key}`}
            type={key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") ? "password" : "text"}
            className="w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:ring-1"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              borderColor: errors[key] ? "var(--color-brand-red)" : "var(--color-neutral-600)",
              color: "var(--color-brand-cream)",
            }}
            value={state.values[key] ?? ""}
            onChange={(e) =>
              onChange({ values: { ...state.values, [key]: e.target.value } })
            }
          />
          {errors[key] ? (
            <p
              className="text-xs"
              style={{ color: "var(--color-brand-red)" }}
              data-wizard-field-error
            >
              {errors[key]}
            </p>
          ) : null}
        </div>
      ))}
      <button
        type="submit"
        className="mt-2 w-full rounded-md px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        style={{
          backgroundColor: "var(--color-brand-pink)",
          color: "var(--color-neutral-950)",
          fontFamily: "var(--font-label)",
        }}
      >
        Continue
      </button>
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
