"use client";

/**
 * `csv-import` step-type — upload → preview → column-map → confirm.
 * Resumable at the preview stage per spec §4 (before upload = start over).
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  type StepComponentProps,
  type StepTypeDefinition,
  invalid,
} from "@/lib/wizards/step-types";

export type CsvImportState = {
  filename: string | null;
  rows: string[][];
  columnMap: Record<string, string>;
  confirmed: boolean;
};

export type CsvImportConfig = {
  /** Expected target columns the user maps source columns to. */
  targetColumns: string[];
};

function CsvImportComponent({
  state,
  onChange,
  onNext,
  config,
}: StepComponentProps<CsvImportState>) {
  const cfg = config as CsvImportConfig | undefined;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = text
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => line.split(","));
      onChange({
        ...state,
        filename: file.name,
        rows,
        confirmed: false,
      });
    };
    reader.readAsText(file);
  };

  const header = state.rows[0] ?? [];
  const preview = state.rows.slice(1, 6);

  return (
    <div data-wizard-step="csv-import" className="space-y-4">
      {!state.filename ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            data-wizard-csv-input
          />
        </label>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Loaded <code>{state.filename}</code> — {state.rows.length} rows.
          </p>
          {cfg?.targetColumns.map((target) => (
            <label key={target} className="flex items-center gap-2 text-sm">
              <span className="min-w-24">{target}</span>
              <select
                value={state.columnMap[target] ?? ""}
                onChange={(e) =>
                  onChange({
                    ...state,
                    columnMap: {
                      ...state.columnMap,
                      [target]: e.target.value,
                    },
                  })
                }
              >
                <option value="">— map —</option>
                {header.map((h, i) => (
                  <option key={i} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <table className="text-xs border w-full" data-wizard-csv-preview>
            <thead>
              <tr>
                {header.map((h, i) => (
                  <th key={i} className="border px-2 py-1 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border px-2 py-1">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            type="button"
            onClick={() => {
              onChange({ ...state, confirmed: true });
              onNext();
            }}
          >
            Looks right — import
          </Button>
        </>
      )}
    </div>
  );
}

export const csvImportStep: StepTypeDefinition<CsvImportState> = {
  type: "csv-import",
  resumableByDefault: true,
  Component: CsvImportComponent,
  resume: (raw) => {
    const r = (raw ?? {}) as Partial<CsvImportState>;
    return {
      filename: typeof r.filename === "string" ? r.filename : null,
      rows: Array.isArray(r.rows) ? (r.rows as string[][]) : [],
      columnMap:
        r.columnMap && typeof r.columnMap === "object"
          ? (r.columnMap as Record<string, string>)
          : {},
      confirmed: Boolean(r.confirmed),
    };
  },
  validate: (state) =>
    state.confirmed ? { ok: true } : invalid("Confirm the import first."),
};
