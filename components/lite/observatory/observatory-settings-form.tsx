"use client";

import { useState, useCallback } from "react";
import type { ObservatorySettings, JobBandRow } from "@/lib/observatory/queries/settings";

function formatAud(value: number): string {
  return `$${value.toFixed(2)}`;
}

function ThresholdField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <label
        className="block text-[12px] font-medium uppercase"
        style={{ letterSpacing: "1px", color: "var(--color-neutral-500)" }}
      >
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <span
          className="text-[14px]"
          style={{ color: "var(--color-neutral-400)" }}
        >
          $
        </span>
        <input
          type="number"
          min={0}
          step={0.01}
          value={value ?? ""}
          placeholder="Not set"
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : parseFloat(raw));
          }}
          className="w-full rounded-md border px-3 py-2 text-[14px] font-mono"
          style={{
            borderColor: "var(--color-neutral-300)",
            backgroundColor: "var(--color-white)",
            color: "var(--color-neutral-100)",
          }}
        />
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border"
        style={{ borderColor: "var(--color-neutral-300)" }}
      />
      <div>
        <span
          className="text-[14px] font-medium"
          style={{ color: "var(--color-neutral-100)" }}
        >
          {label}
        </span>
        <p
          className="text-[13px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          {description}
        </p>
      </div>
    </label>
  );
}

export function ObservatorySettingsForm({
  initialSettings,
  jobs,
}: {
  initialSettings: ObservatorySettings;
  jobs: JobBandRow[];
}) {
  const [form, setForm] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/observatory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }, [form]);

  return (
    <div className="flex flex-col gap-8">
      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Monthly Thresholds
        </h2>
        <p
          className="mt-2 text-[13px]"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Set spend thresholds in AUD. The observatory flags when you cross them.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ThresholdField
            label="Threshold 1"
            value={form.threshold_1_aud}
            onChange={(v) => setForm((f) => ({ ...f, threshold_1_aud: v }))}
          />
          <ThresholdField
            label="Threshold 2"
            value={form.threshold_2_aud}
            onChange={(v) => setForm((f) => ({ ...f, threshold_2_aud: v }))}
          />
          <ThresholdField
            label="Threshold 3"
            value={form.threshold_3_aud}
            onChange={(v) => setForm((f) => ({ ...f, threshold_3_aud: v }))}
          />
        </div>
      </section>

      <section
        className="rounded-xl border p-6"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase"
          style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
        >
          Alerts & Digest
        </h2>
        <div className="mt-4 space-y-4">
          <ToggleField
            label="Projection alerts"
            description="Warn when the linear run-rate projection crosses a threshold before MTD does."
            checked={form.projection_alert_enabled}
            onChange={(v) =>
              setForm((f) => ({ ...f, projection_alert_enabled: v }))
            }
          />
          <ToggleField
            label="Weekly digest"
            description="Sunday evening email summarising the week's spend, tier health, and anomalies."
            checked={form.weekly_digest_enabled}
            onChange={(v) =>
              setForm((f) => ({ ...f, weekly_digest_enabled: v }))
            }
          />
        </div>
      </section>

      <section
        className="rounded-xl border"
        style={{
          borderColor: "var(--color-neutral-200)",
          backgroundColor: "var(--color-neutral-50)",
        }}
      >
        <div className="p-6 pb-3">
          <h2
            className="font-[family-name:var(--font-label)] text-[11px] uppercase"
            style={{
              letterSpacing: "1.5px",
              color: "var(--color-neutral-500)",
            }}
          >
            Registered Jobs
          </h2>
          <p
            className="mt-2 text-[13px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            All jobs the observatory tracks. Bands are editable from the anomaly detail view.
          </p>
        </div>
        <div
          className="overflow-x-auto border-t"
          style={{ borderColor: "var(--color-neutral-200)" }}
        >
          <table className="w-full text-[13px]">
            <thead>
              <tr
                style={{
                  backgroundColor: "var(--color-surface-1)",
                  color: "var(--color-neutral-500)",
                }}
              >
                <th className="px-4 py-2 text-left font-medium">Job</th>
                <th className="px-4 py-2 text-left font-medium">Vendor</th>
                <th className="px-4 py-2 text-right font-medium">Per-call</th>
                <th className="px-4 py-2 text-right font-medium">Daily</th>
                <th className="px-4 py-2 text-right font-medium">Band ×</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-neutral-200)" }}>
              {jobs.map((j) => (
                <tr key={j.job}>
                  <td
                    className="px-4 py-2 font-mono"
                    style={{ color: "var(--color-neutral-100)" }}
                  >
                    <a
                      href={`/lite/observatory/jobs/${encodeURIComponent(j.job)}`}
                      className="underline decoration-dotted underline-offset-2"
                      style={{ color: "var(--color-neutral-100)" }}
                    >
                      {j.job}
                    </a>
                  </td>
                  <td
                    className="px-4 py-2"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {j.vendor}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-mono"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatAud(j.per_call_ceiling_aud)}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-mono"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {formatAud(j.daily_ceiling_aud)}
                  </td>
                  <td
                    className="px-4 py-2 text-right font-mono"
                    style={{ color: "var(--color-neutral-500)" }}
                  >
                    {j.learned_band_multiplier}×
                  </td>
                  <td className="px-4 py-2 text-center">
                    {j.is_disabled ? (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: "var(--color-error-50)",
                          color: "var(--color-error)",
                        }}
                      >
                        Paused
                      </span>
                    ) : (
                      <span
                        className="inline-block rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: "var(--color-success-50)",
                          color: "var(--color-success)",
                        }}
                      >
                        Live
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-6 py-2.5 text-[14px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            color: "var(--color-white)",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
        {saved && (
          <span
            className="text-[13px]"
            style={{ color: "var(--color-success)" }}
          >
            Saved.
          </span>
        )}
      </div>
    </div>
  );
}
