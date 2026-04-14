"use client";

/**
 * `content-picker` step-type — grid/list picker backed by a consumer-provided
 * fetcher. Used for shape-shuffler-style choices (Brand DNA, Intro Funnel).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type ContentPickerItem = {
  id: string;
  label: string;
  description?: string;
};

export type ContentPickerState = {
  items: ContentPickerItem[];
  selectedId: string | null;
};

export type ContentPickerConfig = {
  fetcher: () => Promise<ContentPickerItem[]>;
  layout?: "grid" | "list";
};

function ContentPickerComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<ContentPickerState>) {
  const cfg = config as ContentPickerConfig | undefined;

  React.useEffect(() => {
    if (state.items.length > 0 || !cfg?.fetcher) return;
    let cancelled = false;
    cfg.fetcher().then((items) => {
      if (!cancelled) onChange({ ...state, items });
    });
    return () => {
      cancelled = true;
    };
  }, [state, cfg, onChange]);

  return (
    <div
      data-wizard-step="content-picker"
      data-layout={cfg?.layout ?? "grid"}
      className="space-y-4"
    >
      <div
        className={
          cfg?.layout === "list"
            ? "flex flex-col gap-2"
            : "grid grid-cols-1 sm:grid-cols-3 gap-3"
        }
      >
        {state.items.map((item) => {
          const selected = state.selectedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-wizard-picker-item
              data-selected={selected}
              onClick={() => onChange({ ...state, selectedId: item.id })}
              className={
                "rounded-md border p-3 text-left text-sm transition " +
                (selected ? "border-foreground" : "border-muted")
              }
            >
              <div className="font-medium">{item.label}</div>
              {item.description ? (
                <div className="text-xs text-muted-foreground">
                  {item.description}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      {state.selectedId ? (
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

export const contentPickerStep: StepTypeDefinition<ContentPickerState> = {
  type: "content-picker",
  resumableByDefault: true,
  Component: ContentPickerComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<ContentPickerState>;
    return {
      items: Array.isArray(r.items) ? (r.items as ContentPickerItem[]) : [],
      selectedId: typeof r.selectedId === "string" ? r.selectedId : null,
    };
  },
  validate: (state) =>
    state.selectedId ? { ok: true } : invalid("Pick one to continue."),
};
