"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { JobBands } from "@/lib/observatory/job-registry";

export function AnomalyActions({
  anomalyId,
  job,
  tier,
  isKillSwitched,
  isAcknowledged,
  currentBands,
}: {
  anomalyId: string;
  job: string;
  tier: string;
  isKillSwitched: boolean;
  isAcknowledged: boolean;
  currentBands: JobBands | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [bandEditorOpen, setBandEditorOpen] = useState(false);

  async function handleKillSwitch() {
    setLoading("kill");
    try {
      await fetch("/api/admin/observatory/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          action: isKillSwitched ? "enable" : "disable",
          anomaly_id: anomalyId,
        }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleAcknowledge() {
    setLoading("ack");
    try {
      await fetch("/api/admin/observatory/anomaly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: anomalyId, action: "acknowledge" }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleBandUpdate(field: string, value: number) {
    setLoading("band");
    try {
      await fetch("/api/admin/observatory/bands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, field, value }),
      });
      router.refresh();
    } finally {
      setLoading(null);
      setBandEditorOpen(false);
    }
  }

  const actionBtnBase =
    "rounded-[var(--radius-default)] px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors disabled:opacity-50";

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <h2
        className="font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
      >
        Actions
      </h2>

      <div className="mt-4 flex flex-wrap gap-3">
        {/* Kill switch — prominent for severe */}
        {tier === "severe" && (
          <button
            onClick={handleKillSwitch}
            disabled={loading === "kill"}
            className={actionBtnBase}
            style={{
              letterSpacing: "1.5px",
              background: isKillSwitched
                ? "var(--color-surface-2)"
                : "var(--color-error)",
              color: isKillSwitched
                ? "var(--color-neutral-700)"
                : "var(--color-cream)",
            }}
          >
            {loading === "kill"
              ? "…"
              : isKillSwitched
                ? "Re-enable job"
                : "Kill switch"}
          </button>
        )}

        {/* Acknowledge & suppress */}
        {!isAcknowledged && (
          <button
            onClick={handleAcknowledge}
            disabled={loading === "ack"}
            className={actionBtnBase}
            style={{
              letterSpacing: "1.5px",
              background: "var(--color-surface-2)",
              color: "var(--color-neutral-500)",
            }}
          >
            {loading === "ack" ? "…" : "Acknowledge & suppress 24h"}
          </button>
        )}

        {isAcknowledged && (
          <span
            className="inline-flex items-center rounded-[var(--radius-default)] px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{
              letterSpacing: "1.5px",
              background: "rgba(123, 174, 126, 0.14)",
              color: "var(--color-success)",
            }}
          >
            Acknowledged
          </span>
        )}

        {/* Non-severe kill switch as secondary action */}
        {tier !== "severe" && (
          <button
            onClick={handleKillSwitch}
            disabled={loading === "kill"}
            className={actionBtnBase}
            style={{
              letterSpacing: "1.5px",
              background: "var(--color-surface-2)",
              color: "var(--color-neutral-500)",
            }}
          >
            {loading === "kill"
              ? "…"
              : isKillSwitched
                ? "Re-enable job"
                : "Kill switch"}
          </button>
        )}

        {/* Band editor toggle */}
        {currentBands && (
          <button
            onClick={() => setBandEditorOpen(!bandEditorOpen)}
            className={actionBtnBase}
            style={{
              letterSpacing: "1.5px",
              background: "var(--color-surface-2)",
              color: "var(--color-neutral-500)",
            }}
          >
            {bandEditorOpen ? "Close band editor" : "Adjust bands"}
          </button>
        )}
      </div>

      {/* Inline band editor */}
      {bandEditorOpen && currentBands && (
        <BandEditor
          bands={currentBands}
          loading={loading === "band"}
          onUpdate={handleBandUpdate}
        />
      )}
    </section>
  );
}

function BandEditor({
  bands,
  loading,
  onUpdate,
}: {
  bands: JobBands;
  loading: boolean;
  onUpdate: (field: string, value: number) => void;
}) {
  const [perCall, setPerCall] = useState(
    String(bands.per_call_ceiling_aud ?? ""),
  );
  const [daily, setDaily] = useState(
    String(bands.daily_ceiling_aud ?? ""),
  );

  const inputClass =
    "w-28 rounded-[var(--radius-default)] border border-[var(--color-surface-2)] bg-transparent px-2 py-1.5 font-[family-name:var(--font-mono)] text-[13px] outline-none focus:border-[var(--color-brand-red)]";
  const labelClass =
    "font-[family-name:var(--font-label)] text-[10px] uppercase";
  const labelStyle = { letterSpacing: "1.5px", color: "var(--color-neutral-500)" };

  return (
    <div
      className="mt-4 rounded-[var(--radius-default)] p-4"
      style={{ background: "var(--color-surface-2)" }}
    >
      <p
        className="text-[13px] font-[family-name:var(--font-serif)] italic"
        style={{ color: "var(--color-neutral-500)" }}
      >
        If this is a new normal, raise the band.
      </p>
      <div className="mt-3 flex flex-wrap gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>
            Per-call ceiling (AUD)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              step="0.01"
              value={perCall}
              onChange={(e) => setPerCall(e.target.value)}
              className={inputClass}
              style={{ color: "var(--color-neutral-300)" }}
            />
            <button
              onClick={() => onUpdate("per_call_ceiling_aud", Number(perCall))}
              disabled={loading || !perCall}
              className="rounded-[var(--radius-default)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors disabled:opacity-50"
              style={{
                letterSpacing: "1.5px",
                background: "var(--color-brand-red)",
                color: "var(--color-cream)",
              }}
            >
              Set
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>
            Daily ceiling (AUD)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              step="1"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className={inputClass}
              style={{ color: "var(--color-neutral-300)" }}
            />
            <button
              onClick={() => onUpdate("daily_ceiling_aud", Number(daily))}
              disabled={loading || !daily}
              className="rounded-[var(--radius-default)] px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors disabled:opacity-50"
              style={{
                letterSpacing: "1.5px",
                background: "var(--color-brand-red)",
                color: "var(--color-cream)",
              }}
            >
              Set
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
