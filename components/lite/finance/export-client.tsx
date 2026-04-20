"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FinanceExportRow } from "@/lib/db/schema/finance-exports";
import type { ExportPeriod } from "@/lib/finance/export-queries";

interface ExportClientProps {
  presets: ExportPeriod[];
  pastExports: FinanceExportRow[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type GeneratingState = {
  exportId: string;
  label: string;
  status: "pending" | "generating" | "ready" | "failed";
  error?: string;
};

export function ExportClient({ presets, pastExports: initialPastExports }: ExportClientProps) {
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [generating, setGenerating] = useState<GeneratingState | null>(null);
  const [pastExports, setPastExports] = useState(initialPastExports);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  const pollStatus = useCallback(
    (exportId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/admin/finance-exports/${exportId}/status`);
          if (!res.ok) return;
          const data = await res.json();
          setGenerating((prev) =>
            prev ? { ...prev, status: data.status, error: data.error_message } : null,
          );
          if (data.status === "ready" || data.status === "failed") {
            stopPolling();
            const listRes = await fetch("/api/admin/finance-exports/list");
            if (listRes.ok) {
              const listData = await listRes.json();
              setPastExports(listData.exports ?? []);
            }
          }
        } catch {
          // poll failure — try again next tick
        }
      }, 5000);
    },
    [stopPolling],
  );

  async function handleGenerate(period: ExportPeriod) {
    const formData = new FormData();
    formData.set("period_start", period.start);
    formData.set("period_end", period.end);
    formData.set("period_label", period.label);

    const res = await fetch("/api/admin/finance-exports/generate", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) return;
    const data = await res.json();
    setGenerating({
      exportId: data.export_id,
      label: period.label,
      status: "pending",
    });
    pollStatus(data.export_id);
  }

  function handleCustomGenerate() {
    if (!customStart || !customEnd) return;
    handleGenerate({
      start: customStart,
      end: customEnd,
      label: `Custom ${customStart} to ${customEnd}`,
    });
  }

  const isGenerating = generating && (generating.status === "pending" || generating.status === "generating");

  return (
    <div className="space-y-8">
      {/* Generating state overlay */}
      {isGenerating && (
        <div className="rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] p-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-brand-red)] border-t-transparent" />
            <span className="font-[family-name:var(--font-body)] text-sm text-[color:var(--color-brand-cream)]">
              Rendering the bundle. This takes about a minute for a full quarter. You&apos;ll get an email when it&apos;s ready.
            </span>
          </div>
          <p className="mt-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
            {generating.label}
          </p>
        </div>
      )}

      {generating?.status === "failed" && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 p-4">
          <p className="font-[family-name:var(--font-body)] text-sm text-red-300">
            Export failed{generating.error ? `: ${generating.error}` : "."}
          </p>
        </div>
      )}

      {generating?.status === "ready" && (
        <div className="rounded-lg border border-green-800/50 bg-green-950/30 p-4">
          <div className="flex items-center justify-between">
            <p className="font-[family-name:var(--font-body)] text-sm text-green-300">
              Export ready — {generating.label}
            </p>
            <a
              href={`/api/admin/finance-exports/${generating.exportId}`}
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-red)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "1px" }}
            >
              Download
            </a>
          </div>
        </div>
      )}

      {/* Preset periods */}
      {!isGenerating && (
        <>
          <section>
            <h2
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Quick presets
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {presets.map((p) => (
                <button
                  key={`${p.start}-${p.end}`}
                  onClick={() => handleGenerate(p)}
                  className="rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] px-4 py-3 text-left transition-colors hover:border-[color:var(--color-brand-red)] hover:bg-[color:var(--color-neutral-800)]"
                >
                  <span className="block font-[family-name:var(--font-body)] text-sm text-[color:var(--color-brand-cream)]">
                    {p.label}
                  </span>
                  <span className="font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                    {p.start} → {p.end}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom range */}
          <section>
            <h2
              className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Custom range
            </h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                  From
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] px-3 py-2 font-[family-name:var(--font-body)] text-sm text-[color:var(--color-brand-cream)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                  To
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] px-3 py-2 font-[family-name:var(--font-body)] text-sm text-[color:var(--color-brand-cream)]"
                />
              </div>
              <button
                onClick={handleCustomGenerate}
                disabled={!customStart || !customEnd}
                className="rounded bg-[color:var(--color-brand-red)] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-opacity disabled:opacity-30"
                style={{ letterSpacing: "1px" }}
              >
                Generate
              </button>
            </div>
          </section>
        </>
      )}

      {/* Past exports */}
      {pastExports.length > 0 && (
        <section>
          <h2
            className="mb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Past exports
          </h2>
          <div className="space-y-2">
            {pastExports.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between rounded-lg border border-[color:var(--color-neutral-800)] bg-[color:var(--color-neutral-900)] px-4 py-3"
              >
                <div>
                  <span className="block font-[family-name:var(--font-body)] text-sm text-[color:var(--color-brand-cream)]">
                    {exp.period_label}
                  </span>
                  <span className="font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                    {formatDate(exp.completed_at_ms)}
                    {exp.file_size_bytes ? ` · ${formatBytes(exp.file_size_bytes)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {exp.status === "ready" && (
                    <a
                      href={`/api/admin/finance-exports/${exp.id}`}
                      className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-red)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                      style={{ letterSpacing: "1px" }}
                    >
                      Download
                    </a>
                  )}
                  {exp.status === "failed" && (
                    <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-red-400" style={{ letterSpacing: "1px" }}>
                      Failed
                    </span>
                  )}
                  {(exp.status === "pending" || exp.status === "generating") && (
                    <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                      Generating…
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
