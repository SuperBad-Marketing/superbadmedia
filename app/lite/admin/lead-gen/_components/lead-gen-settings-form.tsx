"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateLeadGenSettingsAction,
  type LeadGenSettings,
} from "../actions";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.06)" }}
    >
      <div className="flex flex-col gap-1 sm:max-w-[360px]">
        <span className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
          {label}
        </span>
        <span className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
          {description}
        </span>
      </div>
      <div className="w-full sm:w-auto sm:shrink-0">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full sm:w-[280px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const textareaClass =
  "w-full sm:w-[400px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)] resize-y min-h-[80px]";

const numberClass =
  "w-full sm:w-[120px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] font-mono bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

export function LeadGenSettingsForm({
  initial,
}: {
  initial: LeadGenSettings;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateLeadGenSettingsAction(form);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Search settings saved.");
    router.refresh();
  }

  return (
    <div className="px-4">
      <SettingRow
        label="Category"
        description="Business type to search for on Google Maps and the Meta Ad Library. e.g. 'cafes', 'dental clinics', 'fitness studios'."
      >
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          placeholder="e.g. cafes"
          className={inputClass}
        />
      </SettingRow>

      <SettingRow
        label="Standing brief"
        description="Describes your ideal prospect. Fed to the AI draft generator and shapes which search terms are used across all discovery sources."
      >
        <textarea
          value={form.standingBrief}
          onChange={(e) =>
            setForm((f) => ({ ...f, standingBrief: e.target.value }))
          }
          placeholder="e.g. Small-to-medium businesses in Melbourne that are already spending on marketing but could be doing it better..."
          className={textareaClass}
          rows={4}
        />
      </SettingRow>

      <SettingRow
        label="Location"
        description="Centre point for location-based discovery (Google Maps)."
      >
        <input
          type="text"
          value={form.locationCentre}
          onChange={(e) =>
            setForm((f) => ({ ...f, locationCentre: e.target.value }))
          }
          placeholder="Melbourne"
          className={inputClass}
        />
      </SettingRow>

      <SettingRow
        label="Radius (km)"
        description="How far from the location centre to search."
      >
        <input
          type="number"
          value={form.locationRadiusKm}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              locationRadiusKm: parseInt(e.target.value) || 0,
            }))
          }
          min={1}
          max={500}
          className={numberClass}
        />
      </SettingRow>

      <SettingRow
        label="Max per day"
        description="Maximum new prospects per daily run (before warmup clamp). Higher = more drafts to review."
      >
        <input
          type="number"
          value={form.dailyMaxPerDay}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              dailyMaxPerDay: parseInt(e.target.value) || 0,
            }))
          }
          min={1}
          max={50}
          className={numberClass}
        />
      </SettingRow>

      <SettingRow
        label="Run time"
        description="When the daily search runs (Melbourne time, 24h format)."
      >
        <input
          type="text"
          value={form.runTime}
          onChange={(e) =>
            setForm((f) => ({ ...f, runTime: e.target.value }))
          }
          placeholder="03:00"
          className={numberClass}
        />
      </SettingRow>

      <SettingRow
        label="Dedup window (days)"
        description="How many days back to check before contacting the same domain again."
      >
        <input
          type="number"
          value={form.dedupWindowDays}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              dedupWindowDays: parseInt(e.target.value) || 0,
            }))
          }
          min={1}
          max={365}
          className={numberClass}
        />
      </SettingRow>

      <SettingRow
        label="Auto-send delay (mins)"
        description="Minutes to wait before auto-sending approved drafts. Only applies when autonomy is in auto-send mode."
      >
        <input
          type="number"
          value={form.autoSendDelayMinutes}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              autoSendDelayMinutes: parseInt(e.target.value) || 0,
            }))
          }
          min={1}
          max={1440}
          className={numberClass}
        />
      </SettingRow>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-6 py-2.5 font-[family-name:var(--font-body)] text-[14px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
