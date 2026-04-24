"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  updateLeadGenSettingsAction,
  suggestSearchParamsAction,
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

const COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "BE", name: "Belgium" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "ZA", name: "South Africa" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "IL", name: "Israel" },
  { code: "HK", name: "Hong Kong" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "RO", name: "Romania" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "AR", name: "Argentina" },
];

export function LeadGenSettingsForm({
  initial,
}: {
  initial: LeadGenSettings;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

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

  async function handleSuggest() {
    setSuggesting(true);
    const res = await suggestSearchParamsAction({
      targetRevenue: form.targetRevenue,
      targetTeamSize: form.targetTeamSize,
      targetIndustry: form.targetIndustry,
      locationCentre: form.locationCentre,
      trackPriority: form.trackPriority,
    });
    setSuggesting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setForm((f) => ({
      ...f,
      category: res.category,
      standingBrief: res.standingBrief,
    }));
    toast.success("Search params suggested — review and save.");
  }

  return (
    <div className="px-4">
      <SectionHeading>Targeting</SectionHeading>

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
        label="Target industry"
        description="What kind of businesses you're looking for. Leave blank for any."
      >
        <input
          type="text"
          value={form.targetIndustry}
          onChange={(e) =>
            setForm((f) => ({ ...f, targetIndustry: e.target.value }))
          }
          placeholder="e.g. hospitality, health & fitness"
          className={inputClass}
        />
      </SettingRow>

      <SettingRow
        label="Target revenue"
        description="Rough annual revenue range of businesses you want to find."
      >
        <input
          type="text"
          value={form.targetRevenue}
          onChange={(e) =>
            setForm((f) => ({ ...f, targetRevenue: e.target.value }))
          }
          placeholder="e.g. $100k–$500k"
          className={inputClass}
        />
      </SettingRow>

      <SettingRow
        label="Target team size"
        description="How many people work at the businesses you're targeting."
      >
        <input
          type="text"
          value={form.targetTeamSize}
          onChange={(e) =>
            setForm((f) => ({ ...f, targetTeamSize: e.target.value }))
          }
          placeholder="e.g. 1–10, 10–50"
          className={inputClass}
        />
      </SettingRow>

      <div className="mt-4">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="rounded-lg px-5 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-neutral-700)",
            color: "var(--color-brand-cream)",
            opacity: suggesting ? 0.5 : 1,
          }}
        >
          {suggesting ? "Thinking…" : "Suggest search from targeting"}
        </button>
        <span className="ml-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          AI generates a category + brief from the fields above
        </span>
      </div>

      <SectionHeading>Search parameters</SectionHeading>

      <SettingRow
        label="Category"
        description="Business type to search for on Google Maps. e.g. 'cafes', 'dental clinics', 'fitness studios'."
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
        description="Describes your ideal prospect. Fed to the AI draft generator and shapes outreach tone."
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
        label="Location mode"
        description="Local targets a specific city. Global auto-identifies the best regions for SaaS signups."
      >
        <select
          value={form.locationMode}
          onChange={(e) =>
            setForm((f) => ({ ...f, locationMode: e.target.value as "local" | "global" }))
          }
          className={selectClass}
        >
          <option value="local">Local — target a specific city</option>
          <option value="global">Global — auto-target best regions for SaaS</option>
        </select>
      </SettingRow>

      {form.locationMode === "local" && (
        <>
          <SettingRow
            label="Country"
            description="Disambiguates the city — 'Melbourne' in Australia vs Florida."
          >
            <select
              value={form.locationCountryCode}
              onChange={(e) => {
                const option = COUNTRIES.find((c) => c.code === e.target.value);
                setForm((f) => ({
                  ...f,
                  locationCountryCode: e.target.value,
                  locationCountry: option?.name ?? "",
                }));
              }}
              className={selectClass}
            >
              <option value="">Select a country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            label="City"
            description="Centre point for location-based discovery (Google Maps)."
          >
            <input
              type="text"
              value={form.locationCentre}
              onChange={(e) =>
                setForm((f) => ({ ...f, locationCentre: e.target.value }))
              }
              placeholder="e.g. Melbourne"
              className={inputClass}
            />
          </SettingRow>

          <SettingRow
            label="Radius (km)"
            description="How far from the city centre to search."
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
        </>
      )}

      {form.locationMode === "global" && (
        <div className="py-4 px-1">
          <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)] italic">
            Global mode analyses enrichment signal density to identify high-potential regions automatically.
            The platform recommends target-rich locations and cycles through them across daily runs.
            You can pin or exclude specific regions from the metrics panel.
          </p>
        </div>
      )}

      <SectionHeading>Run behaviour</SectionHeading>

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
