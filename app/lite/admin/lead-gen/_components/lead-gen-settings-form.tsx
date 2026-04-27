"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateLeadGenSettingsAction,
  geocodePlaceAction,
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 mb-2 pt-6" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.08)" }}>
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {children}
      </span>
    </div>
  );
}

const inputClass =
  "w-full sm:w-[280px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const textareaClass =
  "w-full sm:w-[400px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] placeholder:text-[color:var(--color-neutral-500)] focus:outline-none focus:border-[color:var(--color-brand-pink)] resize-y min-h-[80px]";

const numberClass =
  "w-full sm:w-[120px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] font-mono bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

const selectClass =
  "w-full sm:w-[280px] rounded-md border px-3 py-2 text-[14px] font-[family-name:var(--font-body)] bg-[color:var(--color-neutral-800)] text-[color:var(--color-brand-cream)] border-[color:var(--color-neutral-600)] focus:outline-none focus:border-[color:var(--color-brand-pink)]";

export function LeadGenSettingsForm({
  initial,
}: {
  initial: LeadGenSettings;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locationInput, setLocationInput] = useState(initial.locationCentre);
  const [resolvedDisplay, setResolvedDisplay] = useState<string | null>(
    initial.locationLat !== 0 ? `${initial.locationCentre} (${initial.locationLat.toFixed(4)}, ${initial.locationLng.toFixed(4)})` : null,
  );

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

  async function handleResolveLocation() {
    if (!locationInput.trim()) {
      toast.error("Enter a place name first.");
      return;
    }
    setResolving(true);
    const res = await geocodePlaceAction(locationInput);
    setResolving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setForm((f) => ({
      ...f,
      locationCentre: locationInput.trim(),
      locationLat: res.lat,
      locationLng: res.lng,
      locationCountryCode: res.countryCode,
      locationCountry: res.displayName.split(",").pop()?.trim() ?? "",
    }));
    setResolvedDisplay(`${res.displayName.split(",").slice(0, 2).join(",")} (${res.lat.toFixed(4)}, ${res.lng.toFixed(4)})`);
    toast.success("Location resolved.");
  }

  return (
    <div className="px-4">
      <SectionHeading>Location</SectionHeading>

      <SettingRow
        label="Search location"
        description="Where to find businesses. Type a city or area name and hit resolve — coordinates are filled in automatically."
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleResolveLocation();
                }
              }}
              placeholder="e.g. Melbourne, Australia"
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleResolveLocation}
              disabled={resolving}
              className="shrink-0 rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
              style={{
                backgroundColor: "var(--color-neutral-700)",
                color: "var(--color-brand-cream)",
                opacity: resolving ? 0.5 : 1,
              }}
            >
              {resolving ? "Resolving…" : "Resolve"}
            </button>
          </div>
          {resolvedDisplay && (
            <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
              {resolvedDisplay}
            </span>
          )}
        </div>
      </SettingRow>

      <SettingRow
        label="Search radius (km)"
        description="How far from the location centre to search. Also sets the travel range for trial shoots."
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

      <SectionHeading>Discovery</SectionHeading>

      <SettingRow
        label="Track priority"
        description="Which type of lead to prioritise. SaaS = small teams who'd use a self-serve tool. Retainer = established businesses ready for a full-service agency."
      >
        <select
          value={form.trackPriority}
          onChange={(e) =>
            setForm((f) => ({ ...f, trackPriority: e.target.value }))
          }
          className={selectClass}
        >
          <option value="both">Both equally</option>
          <option value="saas">SaaS leads only</option>
          <option value="retainer">Retainer leads only</option>
        </select>
      </SettingRow>

      <SettingRow
        label="Standing brief"
        description="Describes your ideal prospect. Shapes how outreach emails are personalised."
      >
        <textarea
          value={form.standingBrief}
          onChange={(e) =>
            setForm((f) => ({ ...f, standingBrief: e.target.value }))
          }
          placeholder="e.g. Ambitious businesses investing in their brand but underperforming on content. They have a story worth telling and the revenue to back a proper marketing partnership."
          className={textareaClass}
          rows={4}
        />
      </SettingRow>

      <SectionHeading>Run behaviour</SectionHeading>

      <SettingRow
        label="Daily target"
        description="How many qualified businesses to find per daily run. The pipeline searches broadly and filters down to this number."
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
