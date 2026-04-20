"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import type {
  InfraEmailListValue,
  InfraAdExperienceValue,
  InfraLeadMagnetValue,
  InfraWebsiteStatusValue,
  InfraSocialCadenceValue,
} from "@/lib/db/schema/trial-shoot-notes";

import type { SixWeekPlanStatus } from "@/lib/db/schema/six-week-plans";

import {
  saveShootDayNotesAction,
  generateSixWeekPlanAction,
} from "@/app/lite/admin/companies/[id]/actions";

// ── Types ──────────────────────────────────────────────────────────────

interface Goal {
  priority: number;
  text: string;
}

export interface ShootDayNotesData {
  id: string | null;
  dealId: string;
  infraEmailList: InfraEmailListValue | null;
  infraEmailListNote: string | null;
  infraAdExperience: InfraAdExperienceValue | null;
  infraAdExperienceNote: string | null;
  infraLeadMagnet: InfraLeadMagnetValue | null;
  infraLeadMagnetNote: string | null;
  infraWebsiteStatus: InfraWebsiteStatusValue | null;
  infraWebsiteCms: string | null;
  infraSocialCadence: InfraSocialCadenceValue | null;
  infraSocialPrimaryPlatform: string | null;
  infraCompetitors: string | null;
  goalsJson: Goal[] | null;
  signalEnergy: number | null;
  signalFluency: number | null;
  signalIcpClarity: number | null;
  signalConversionReady: number | null;
  observations: string | null;
  enrichmentPrefillJson: Record<string, unknown> | null;
  filledAtMs: number | null;
}

export interface PlanStatusData {
  planId: string;
  status: SixWeekPlanStatus;
}

export interface ShootDayNotesPanelProps {
  companyId: string;
  dealId: string;
  dealTitle: string;
  notes: ShootDayNotesData | null;
  planStatus: PlanStatusData | null;
  observationsMinChars?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────

const INFRA_EMAIL_OPTIONS: { value: InfraEmailListValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "exists_small", label: "Exists — small" },
  { value: "exists_moderate", label: "Exists — moderate" },
  { value: "exists_large", label: "Exists — large" },
];

const INFRA_AD_OPTIONS: { value: InfraAdExperienceValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "tried_and_stopped", label: "Tried and stopped" },
  { value: "currently_running_low", label: "Currently running — low" },
  { value: "currently_running_substantial", label: "Currently running — substantial" },
];

const INFRA_LEAD_MAGNET_OPTIONS: { value: InfraLeadMagnetValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "one", label: "One" },
  { value: "multiple", label: "Multiple" },
];

const INFRA_WEBSITE_OPTIONS: { value: InfraWebsiteStatusValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "diy_builder", label: "DIY builder" },
  { value: "custom", label: "Custom" },
  { value: "pro_built", label: "Pro-built" },
];

const INFRA_SOCIAL_OPTIONS: { value: InfraSocialCadenceValue; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sporadic", label: "Sporadic" },
  { value: "weekly", label: "Weekly" },
  { value: "multi_weekly", label: "Multi-weekly" },
];

const SIGNAL_FIELDS: {
  key: "signalEnergy" | "signalFluency" | "signalIcpClarity" | "signalConversionReady";
  label: string;
  anchor1: string;
  anchor5: string;
}[] = [
  { key: "signalEnergy", label: "Energy", anchor1: "Burnt out", anchor5: "On fire" },
  { key: "signalFluency", label: "Fluency on offering", anchor1: "Can't describe it", anchor5: "Crystal clear" },
  { key: "signalIcpClarity", label: "Clarity of ICP", anchor1: "\"Anyone really\"", anchor5: "Names specific audience" },
  { key: "signalConversionReady", label: "Conversion-readiness", anchor1: "No funnel", anchor5: "Working funnel" },
];

const PLAN_STATUS_DISPLAY: Record<SixWeekPlanStatus, { label: string; tone: "neutral" | "amber" | "green" | "muted" }> = {
  generating: { label: "Generating", tone: "amber" },
  pending_strategy_review: { label: "Strategy review", tone: "amber" },
  pending_detail_review: { label: "Detail review", tone: "amber" },
  approved: { label: "Approved", tone: "green" },
  superseded: { label: "Superseded", tone: "muted" },
  released: { label: "Released", tone: "green" },
  archived: { label: "Archived", tone: "muted" },
};

const TONE_COLORS: Record<string, { bg: string; color: string }> = {
  neutral: { bg: "rgba(128, 127, 115, 0.15)", color: "var(--color-neutral-300)" },
  amber: { bg: "rgba(242, 140, 82, 0.14)", color: "var(--color-brand-orange)" },
  green: { bg: "rgba(123, 174, 126, 0.14)", color: "var(--color-success)" },
  muted: { bg: "rgba(128, 127, 115, 0.10)", color: "var(--color-neutral-500)" },
};

// ── Component ──────────────────────────────────────────────────────────

const DEFAULT_OBSERVATIONS_MIN_CHARS = 40;

export function ShootDayNotesPanel({
  companyId,
  dealId,
  dealTitle,
  notes,
  planStatus,
  observationsMinChars,
}: ShootDayNotesPanelProps) {
  const obsMinChars = observationsMinChars ?? DEFAULT_OBSERVATIONS_MIN_CHARS;
  // Infrastructure
  const [emailList, setEmailList] = useState<InfraEmailListValue | null>(notes?.infraEmailList ?? null);
  const [emailListNote, setEmailListNote] = useState(notes?.infraEmailListNote ?? "");
  const [adExperience, setAdExperience] = useState<InfraAdExperienceValue | null>(notes?.infraAdExperience ?? null);
  const [adExperienceNote, setAdExperienceNote] = useState(notes?.infraAdExperienceNote ?? "");
  const [leadMagnet, setLeadMagnet] = useState<InfraLeadMagnetValue | null>(notes?.infraLeadMagnet ?? null);
  const [leadMagnetNote, setLeadMagnetNote] = useState(notes?.infraLeadMagnetNote ?? "");
  const [websiteStatus, setWebsiteStatus] = useState<InfraWebsiteStatusValue | null>(notes?.infraWebsiteStatus ?? null);
  const [websiteCms, setWebsiteCms] = useState(notes?.infraWebsiteCms ?? "");
  const [socialCadence, setSocialCadence] = useState<InfraSocialCadenceValue | null>(notes?.infraSocialCadence ?? null);
  const [socialPrimaryPlatform, setSocialPrimaryPlatform] = useState(notes?.infraSocialPrimaryPlatform ?? "");
  const [competitors, setCompetitors] = useState(notes?.infraCompetitors ?? "");

  // Goals
  const [goals, setGoals] = useState<Goal[]>(
    notes?.goalsJson?.length ? notes.goalsJson : [{ priority: 1, text: "" }],
  );

  // Signals
  const [signalEnergy, setSignalEnergy] = useState<number | null>(notes?.signalEnergy ?? null);
  const [signalFluency, setSignalFluency] = useState<number | null>(notes?.signalFluency ?? null);
  const [signalIcpClarity, setSignalIcpClarity] = useState<number | null>(notes?.signalIcpClarity ?? null);
  const [signalConversionReady, setSignalConversionReady] = useState<number | null>(notes?.signalConversionReady ?? null);

  const signalState: Record<string, number | null> = {
    signalEnergy, signalFluency, signalIcpClarity, signalConversionReady,
  };
  const signalSetters: Record<string, (v: number | null) => void> = {
    signalEnergy: setSignalEnergy,
    signalFluency: setSignalFluency,
    signalIcpClarity: setSignalIcpClarity,
    signalConversionReady: setSignalConversionReady,
  };

  // Observations
  const [observations, setObservations] = useState(notes?.observations ?? "");

  // Transitions
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGenerate] = useTransition();
  const [showConfirmIncomplete, setShowConfirmIncomplete] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanStatusData | null>(planStatus);

  const hasEnrichment = notes?.enrichmentPrefillJson != null;

  // Validation
  const allInfraFilled = emailList != null && adExperience != null && leadMagnet != null && websiteStatus != null && socialCadence != null;
  const hasGoal = goals.some((g) => g.text.trim().length > 0);
  const allSignalsFilled = signalEnergy != null && signalFluency != null && signalIcpClarity != null && signalConversionReady != null;
  const observationsValid = observations.trim().length >= obsMinChars;
  const isComplete = allInfraFilled && hasGoal && allSignalsFilled && observationsValid;

  const updateGoal = useCallback((idx: number, text: string) => {
    setGoals((prev) => prev.map((g, i) => (i === idx ? { ...g, text } : g)));
  }, []);

  const addGoal = useCallback(() => {
    if (goals.length >= 3) return;
    setGoals((prev) => [...prev, { priority: prev.length + 1, text: "" }]);
  }, [goals.length]);

  const removeGoal = useCallback((idx: number) => {
    setGoals((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.map((g, i) => ({ ...g, priority: i + 1 }));
    });
  }, []);

  function collectFormData() {
    return {
      dealId,
      infraEmailList: emailList,
      infraEmailListNote: emailListNote || null,
      infraAdExperience: adExperience,
      infraAdExperienceNote: adExperienceNote || null,
      infraLeadMagnet: leadMagnet,
      infraLeadMagnetNote: leadMagnetNote || null,
      infraWebsiteStatus: websiteStatus,
      infraWebsiteCms: websiteCms || null,
      infraSocialCadence: socialCadence,
      infraSocialPrimaryPlatform: socialPrimaryPlatform || null,
      infraCompetitors: competitors || null,
      goals: goals.filter((g) => g.text.trim()),
      signalEnergy,
      signalFluency,
      signalIcpClarity,
      signalConversionReady,
      observations: observations.trim() || null,
    };
  }

  function handleSave() {
    startSave(async () => {
      const res = await saveShootDayNotesAction(companyId, collectFormData());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Notes saved.");
    });
  }

  function handleGenerate(force = false) {
    if (!isComplete && !force) {
      setShowConfirmIncomplete(true);
      return;
    }
    setShowConfirmIncomplete(false);
    startGenerate(async () => {
      const saveRes = await saveShootDayNotesAction(companyId, collectFormData());
      if (!saveRes.ok) {
        toast.error(saveRes.error);
        return;
      }
      const genRes = await generateSixWeekPlanAction(companyId, dealId);
      if (!genRes.ok) {
        toast.error(genRes.error);
        return;
      }
      setCurrentPlan({ planId: genRes.value.planId, status: "generating" });
      toast.success("Plan generation started.");
    });
  }

  const hasPlan = currentPlan != null;
  const planIsActive = hasPlan && !["archived", "superseded"].includes(currentPlan.status);

  return (
    <section
      aria-label="Shoot-day notes"
      className="overflow-hidden rounded-[12px]"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-baseline justify-between px-5 py-3"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.8px" }}
        >
          Shoot-Day Notes
        </h2>
        <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          {dealTitle}
        </span>
      </div>

      <div className="space-y-6 p-5">
        {/* Plan status badge */}
        {currentPlan && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PlanStatusBadge status={currentPlan.status} />
              {["pending_strategy_review", "pending_detail_review"].includes(currentPlan.status) && (
                <Link
                  href={`/lite/six-week-plans/${currentPlan.planId}/review`}
                  className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-pink)] underline decoration-[color:var(--color-brand-pink)]/30 underline-offset-2 transition-colors hover:text-[color:var(--color-brand-cream)]"
                >
                  Open review →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* §3.1 Marketing Infrastructure */}
        <fieldset className="space-y-4">
          <legend
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Marketing Infrastructure
          </legend>
          {hasEnrichment && (
            <p className="text-[11px] italic text-[color:var(--color-neutral-500)]">
              Pre-filled from enrichment — confirm or correct.
            </p>
          )}

          <InfraField
            label="Email list"
            options={INFRA_EMAIL_OPTIONS}
            value={emailList}
            onChange={setEmailList as (v: string | null) => void}
            note={emailListNote}
            onNoteChange={setEmailListNote}
            disabled={isSaving || isGenerating}
          />
          <InfraField
            label="Ad experience"
            options={INFRA_AD_OPTIONS}
            value={adExperience}
            onChange={setAdExperience as (v: string | null) => void}
            note={adExperienceNote}
            onNoteChange={setAdExperienceNote}
            disabled={isSaving || isGenerating}
          />
          <InfraField
            label="Lead magnet"
            options={INFRA_LEAD_MAGNET_OPTIONS}
            value={leadMagnet}
            onChange={setLeadMagnet as (v: string | null) => void}
            note={leadMagnetNote}
            onNoteChange={setLeadMagnetNote}
            disabled={isSaving || isGenerating}
          />
          <InfraField
            label="Website status"
            options={INFRA_WEBSITE_OPTIONS}
            value={websiteStatus}
            onChange={setWebsiteStatus as (v: string | null) => void}
            disabled={isSaving || isGenerating}
          >
            <Input
              placeholder="CMS (e.g. Shopify, WordPress)"
              value={websiteCms}
              onChange={(e) => setWebsiteCms(e.target.value)}
              disabled={isSaving || isGenerating}
              className="mt-1.5"
            />
          </InfraField>
          <InfraField
            label="Social posting cadence"
            options={INFRA_SOCIAL_OPTIONS}
            value={socialCadence}
            onChange={setSocialCadence as (v: string | null) => void}
            disabled={isSaving || isGenerating}
          >
            <Input
              placeholder="Primary platform (e.g. Instagram)"
              value={socialPrimaryPlatform}
              onChange={(e) => setSocialPrimaryPlatform(e.target.value)}
              disabled={isSaving || isGenerating}
              className="mt-1.5"
            />
          </InfraField>

          <div className="space-y-1.5">
            <Label className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
              Known competitors
            </Label>
            <Input
              placeholder="Comma-separated (1–5)"
              value={competitors}
              onChange={(e) => setCompetitors(e.target.value)}
              disabled={isSaving || isGenerating}
            />
          </div>
        </fieldset>

        {/* §3.2 Goals */}
        <fieldset className="space-y-3">
          <legend
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Goals
          </legend>
          <p className="text-[12px] text-[color:var(--color-neutral-500)]">
            What does this business most want to move in the next 6 weeks? In their own words if you can.
          </p>
          {goals.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="shrink-0 font-[family-name:var(--font-label)] text-[11px] text-[color:var(--color-neutral-500)]">
                {i + 1}.
              </span>
              <Input
                value={g.text}
                onChange={(e) => updateGoal(i, e.target.value)}
                placeholder={i === 0 ? "Most important" : i === 1 ? "Second priority" : "Third priority"}
                disabled={isSaving || isGenerating}
              />
              {goals.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGoal(i)}
                  className="shrink-0 text-[12px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                  disabled={isSaving || isGenerating}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {goals.length < 3 && (
            <button
              type="button"
              onClick={addGoal}
              className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              disabled={isSaving || isGenerating}
            >
              + Add goal
            </button>
          )}
        </fieldset>

        {/* §3.3 Shoot-Day Signals */}
        <fieldset className="space-y-4">
          <legend
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Shoot-Day Signals
          </legend>
          <p className="text-[12px] text-[color:var(--color-neutral-500)]">
            Your in-person read. These calibrate the generator — they don&apos;t appear in the plan text.
          </p>
          {SIGNAL_FIELDS.map((sf) => (
            <SignalField
              key={sf.key}
              label={sf.label}
              anchor1={sf.anchor1}
              anchor5={sf.anchor5}
              value={signalState[sf.key]}
              onChange={(v) => signalSetters[sf.key](v)}
              disabled={isSaving || isGenerating}
            />
          ))}
        </fieldset>

        {/* §3.4 Observations */}
        <fieldset className="space-y-2">
          <legend
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Observations
          </legend>
          <p className="text-[12px] text-[color:var(--color-neutral-500)]">
            2–6 sentences. What wouldn&apos;t come through on a form? What should the plan absolutely know about this person?
          </p>
          <Textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={4}
            disabled={isSaving || isGenerating}
            placeholder="Runs the business with their partner, partner does the books. Really wants to be known as the 'cold-brew first' café in the suburb — it's how they introduce themselves. Struggles with saying no to custom cake orders that eat margin."
          />
          <p className={cn(
            "text-[11px]",
            observations.trim().length >= obsMinChars
              ? "text-[color:var(--color-neutral-500)]"
              : "text-[color:var(--color-brand-orange)]",
          )}>
            {observations.trim().length}/{obsMinChars} min characters
          </p>
        </fieldset>

        {/* Actions */}
        <div
          className="flex flex-wrap items-center gap-3 pt-2"
          style={{ borderTop: "1px solid rgba(253, 245, 230, 0.05)" }}
        >
          <Button
            onClick={handleSave}
            disabled={isSaving || isGenerating}
            variant="outline"
            size="sm"
          >
            {isSaving ? "Saving…" : "Save notes"}
          </Button>

          {!planIsActive && (
            <Button
              onClick={() => handleGenerate(false)}
              disabled={isSaving || isGenerating}
              size="sm"
            >
              {isGenerating ? "Starting…" : "Generate plan"}
            </Button>
          )}

          {!isComplete && !planIsActive && (
            <span className="text-[11px] text-[color:var(--color-brand-orange)]">
              Incomplete — plan quality will degrade
            </span>
          )}
        </div>

        {/* Soft override modal */}
        {showConfirmIncomplete && (
          <div
            className="rounded-[8px] p-4"
            style={{
              background: "rgba(242, 140, 82, 0.08)",
              border: "1px solid rgba(242, 140, 82, 0.2)",
            }}
          >
            <p className="text-[13px] text-[color:var(--color-neutral-300)]">
              Generate with incomplete notes? The LLM will flag more low-confidence assumptions and plan quality degrades measurably.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => handleGenerate(true)}
                disabled={isGenerating}
                size="sm"
                variant="outline"
              >
                Generate anyway
              </Button>
              <Button
                onClick={() => setShowConfirmIncomplete(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function PlanStatusBadge({ status }: { status: SixWeekPlanStatus }) {
  const display = PLAN_STATUS_DISPLAY[status];
  const tone = TONE_COLORS[display.tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {display.label}
    </span>
  );
}

function InfraField<T extends string>({
  label,
  options,
  value,
  onChange,
  note,
  onNoteChange,
  disabled,
  children,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  note?: string;
  onNoteChange?: (v: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
        {label}
      </Label>
      <RadioGroup
        value={value ?? ""}
        onValueChange={(v: string) => onChange(v as T)}
        disabled={disabled}
        className="flex flex-wrap gap-x-4 gap-y-1"
      >
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-1.5"
          >
            <RadioGroupItem value={opt.value} />
            <span className="text-[12px] text-[color:var(--color-neutral-300)]">
              {opt.label}
            </span>
          </label>
        ))}
      </RadioGroup>
      {onNoteChange != null && (
        <Input
          placeholder="Optional note"
          value={note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={disabled}
          className="mt-1"
        />
      )}
      {children}
    </div>
  );
}

function SignalField({
  label,
  anchor1,
  anchor5,
  value,
  onChange,
  disabled,
}: {
  label: string;
  anchor1: string;
  anchor5: string;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] text-[color:var(--color-neutral-500)]">
          {anchor1}
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              disabled={disabled}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-medium transition-colors",
                value === n
                  ? "bg-[color:var(--color-brand-pink)] text-[color:var(--color-brand-charcoal)]"
                  : "bg-[rgba(253,245,230,0.05)] text-[color:var(--color-neutral-300)] hover:bg-[rgba(253,245,230,0.1)]",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="shrink-0 text-[10px] text-[color:var(--color-neutral-500)]">
          {anchor5}
        </span>
      </div>
    </div>
  );
}
