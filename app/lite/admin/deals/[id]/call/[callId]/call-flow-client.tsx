"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { CallTemplate, SectionsState } from "@/lib/call-templates";
import type { CallStatus, CallTemperature } from "@/lib/db/schema/call-logs";
import {
  generateBriefingAction,
  startCallAction,
  saveCallProgressAction,
  endCallAction,
  submitDebriefAction,
  generateSynthesisAction,
  completeCallAction,
} from "../actions";
import { transitionDealAction } from "@/app/lite/admin/pipeline/actions";

const HOUSE_SPRING = { type: "spring" as const, mass: 1, stiffness: 220, damping: 25 };

const TEMP_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  hot: { label: "Hot", color: "var(--brand-red)", bg: "rgba(178, 40, 72, 0.15)" },
  warm: { label: "Warm", color: "var(--brand-orange)", bg: "rgba(242, 140, 82, 0.15)" },
  cool: { label: "Cool", color: "var(--neutral-300)", bg: "rgba(212, 210, 194, 0.1)" },
  cold: { label: "Cold", color: "var(--neutral-500)", bg: "rgba(128, 127, 115, 0.1)" },
};

interface CallFlowProps {
  call: {
    id: string;
    dealId: string;
    status: CallStatus;
    templateType: string;
    temperature: string | null;
    agreedNextStep: string | null;
    followUpDateMs: number | null;
    blockers: string | null;
    sectionsData: SectionsState;
    llmBriefing: Record<string, unknown> | null;
    llmCustomQuestions: unknown[] | null;
    llmSynthesis: Record<string, unknown> | null;
    createdAtMs: number;
  };
  deal: { id: string; title: string; stage: string };
  companyName: string;
  contactName: string | null;
  template: CallTemplate;
}

export function CallFlowClient({ call, deal, companyName, contactName, template }: CallFlowProps) {
  const [status, setStatus] = React.useState<CallStatus>(call.status);
  const [briefing, setBriefing] = React.useState(call.llmBriefing);
  const [customQuestions, setCustomQuestions] = React.useState(call.llmCustomQuestions);
  const [synthesis, setSynthesis] = React.useState(call.llmSynthesis);
  const [sectionsData, setSectionsData] = React.useState<SectionsState>(call.sectionsData);
  const [temperature, setTemperature] = React.useState<CallTemperature | null>(call.temperature as CallTemperature | null);
  const [agreedNextStep, setAgreedNextStep] = React.useState(call.agreedNextStep ?? "");
  const [followUpDate, setFollowUpDate] = React.useState(call.followUpDateMs ? new Date(call.followUpDateMs).toISOString().split("T")[0] : "");
  const [blockers, setBlockers] = React.useState(call.blockers ?? "");
  const [loading, setLoading] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const router = useRouter();

  React.useEffect(() => {
    if (status === "active") {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [status]);

  const totalQuestions = template.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const coveredQuestions = Object.values(sectionsData).filter(v => v.checked).length;

  function updateQuestion(questionId: string, field: "checked" | "notes", value: boolean | string) {
    setSectionsData(prev => {
      const next = { ...prev, [questionId]: { ...prev[questionId], [field]: value } };
      if (!next[questionId].checked && field !== "checked") next[questionId].checked = prev[questionId]?.checked ?? false;
      if (!next[questionId].notes && field !== "notes") next[questionId].notes = prev[questionId]?.notes ?? "";

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => { saveCallProgressAction(call.id, next); }, 800);

      return next;
    });
  }

  async function handleGenerateBriefing() {
    setLoading(true);
    await generateBriefingAction(call.id);
    router.refresh();
    setLoading(false);
  }

  async function handleStartCall() {
    setLoading(true);
    await startCallAction(call.id);
    setStatus("active");
    setLoading(false);
  }

  async function handleEndCall() {
    setLoading(true);
    await saveCallProgressAction(call.id, sectionsData);
    await endCallAction(call.id);
    setStatus("debrief");
    setLoading(false);
    clearInterval(timerRef.current);
  }

  async function handleSubmitDebrief() {
    if (!temperature) return;
    setLoading(true);
    await submitDebriefAction(call.id, {
      temperature,
      agreedNextStep,
      followUpDateMs: followUpDate ? new Date(followUpDate).getTime() : null,
      blockers,
    });
    await generateSynthesisAction(call.id);
    router.refresh();
    setLoading(false);
  }

  async function handleComplete() {
    setLoading(true);
    await completeCallAction(call.id);
    router.push(`/lite/admin/pipeline/${deal.id}`);
  }

  async function handleTransitionStage(targetStage: string) {
    await transitionDealAction(deal.id, targetStage as never);
    router.refresh();
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const briefingData = briefing as { situationSummary?: string; lastCallRecap?: string; unresolvedItems?: string[]; talkingPoints?: string[] } | null;
  const synthesisData = synthesis as { summary?: string; nextActions?: { text: string; actionType: string; actionData?: Record<string, string> }[]; stageRecommendation?: { shouldMove: boolean; targetStage?: string; reason?: string }; flags?: string[] } | null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-6 pb-32">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] px-2.5 py-1 rounded-full border"
            style={{
              color: "var(--brand-pink)",
              borderColor: "rgba(244, 160, 176, 0.2)",
              background: "rgba(244, 160, 176, 0.08)",
            }}
          >
            {template.label}
          </span>
          {status === "active" && (
            <span className="text-[13px] text-[color:var(--neutral-500)] tabular-nums">
              {formatElapsed(elapsed)}
            </span>
          )}
          {status === "complete" && (
            <span className="text-[12px] text-[color:var(--success)] font-medium">Complete</span>
          )}
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-tight text-[color:var(--neutral-100)]">
          {companyName}
        </h1>
        <p className="text-[14px] text-[color:var(--neutral-500)] mt-1">
          {deal.title}{contactName ? ` · ${contactName}` : ""} · {deal.stage.replace("_", " ")}
        </p>
      </div>

      {/* Progress bar */}
      {(status === "active" || status === "debrief") && (
        <div className="mb-6 rounded-lg bg-[color:var(--surface-1)] border border-[color:var(--neutral-700)] p-4">
          <div className="flex justify-between text-[12px] text-[color:var(--neutral-500)] mb-2">
            <span>Progress</span>
            <span>{coveredQuestions} of {totalQuestions} questions covered</span>
          </div>
          <div className="h-2 rounded-full bg-[color:var(--surface-3)] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--brand-pink)" }}
              initial={{ width: 0 }}
              animate={{ width: `${totalQuestions > 0 ? (coveredQuestions / totalQuestions) * 100 : 0}%` }}
              transition={HOUSE_SPRING}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* PREP PHASE */}
        {status === "prep" && (
          <motion.div key="prep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!briefing ? (
              <div className="text-center py-12">
                <button
                  onClick={handleGenerateBriefing}
                  disabled={loading}
                  className="rounded-xl px-8 py-4 text-[15px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    background: "var(--accent-cta)",
                    color: "var(--accent-cta-fg)",
                  }}
                >
                  {loading ? "Generating briefing..." : "Generate Pre-Call Briefing"}
                </button>
                <p className="text-[13px] text-[color:var(--neutral-500)] mt-4">
                  Analyses deal history, past calls, and company context to prepare your briefing.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Briefing card */}
                <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6" style={{ boxShadow: "var(--surface-highlight)" }}>
                  <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--brand-pink)] mb-4">Pre-call Briefing</h2>

                  {briefingData?.situationSummary && (
                    <div className="mb-4">
                      <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-1">Situation</div>
                      <p className="text-[14px] text-[color:var(--neutral-300)] leading-relaxed">{briefingData.situationSummary}</p>
                    </div>
                  )}

                  {briefingData?.lastCallRecap && (
                    <div className="mb-4">
                      <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-1">Last call</div>
                      <p className="text-[14px] text-[color:var(--neutral-300)] leading-relaxed">{briefingData.lastCallRecap}</p>
                    </div>
                  )}

                  {briefingData?.unresolvedItems && briefingData.unresolvedItems.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-1">Unresolved</div>
                      <ul className="space-y-1">
                        {briefingData.unresolvedItems.map((item, i) => (
                          <li key={i} className="text-[14px] text-[color:var(--neutral-300)] flex gap-2">
                            <span className="text-[color:var(--brand-orange)]">·</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {briefingData?.talkingPoints && briefingData.talkingPoints.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-1">Talking points</div>
                      <ul className="space-y-1">
                        {briefingData.talkingPoints.map((point, i) => (
                          <li key={i} className="text-[14px] text-[color:var(--neutral-100)] flex gap-2">
                            <span className="text-[color:var(--brand-pink)]">{i + 1}.</span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Template preview */}
                <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6" style={{ boxShadow: "var(--surface-highlight)" }}>
                  <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--neutral-500)] mb-3">Call Structure</h2>
                  <div className="space-y-2">
                    {template.sections.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-3 text-[14px]">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[color:var(--surface-3)] text-[color:var(--neutral-500)] text-[11px] font-medium">
                          {i + 1}
                        </span>
                        <span className="text-[color:var(--neutral-300)]">{s.title}</span>
                        <span className="text-[color:var(--neutral-600)] text-[12px]">({s.questions.length}q)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-center pt-4">
                  <button
                    onClick={handleStartCall}
                    disabled={loading}
                    className="rounded-xl px-10 py-4 text-[16px] font-bold transition-all cursor-pointer disabled:opacity-50"
                    style={{
                      background: "var(--accent-cta)",
                      color: "var(--accent-cta-fg)",
                    }}
                  >
                    {loading ? "Starting..." : "Start Call"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ACTIVE PHASE */}
        {status === "active" && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Pinned talking points */}
            {briefingData?.talkingPoints && briefingData.talkingPoints.length > 0 && (
              <TalkingPointsCard points={briefingData.talkingPoints} />
            )}

            {/* Sections */}
            <div className="space-y-4">
              {template.sections.map((section, sIdx) => (
                <CallSection
                  key={section.id}
                  section={section}
                  index={sIdx}
                  sectionsData={sectionsData}
                  customQuestions={(customQuestions ?? []) as { targetSection: string; text: string; boldPhrase?: string; signals: { level: string; text: string }[] }[]}
                  onUpdate={updateQuestion}
                />
              ))}
            </div>

            {/* End call */}
            <div className="sticky bottom-6 mt-8 flex justify-center">
              <button
                onClick={handleEndCall}
                disabled={loading}
                className="rounded-xl px-8 py-3 text-[15px] font-semibold shadow-lg cursor-pointer disabled:opacity-50 transition-all"
                style={{
                  background: "var(--brand-red)",
                  color: "var(--neutral-100)",
                }}
              >
                {loading ? "Ending..." : "End Call"}
              </button>
            </div>
          </motion.div>
        )}

        {/* DEBRIEF PHASE */}
        {status === "debrief" && (
          <motion.div key="debrief" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!synthesis ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6" style={{ boxShadow: "var(--surface-highlight)" }}>
                  <h2 className="font-[family-name:var(--font-label)] text-[16px] text-[color:var(--neutral-100)] mb-6">Quick Debrief</h2>

                  {/* Temperature */}
                  <div className="mb-5">
                    <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-2">How did it feel?</div>
                    <div className="flex gap-2">
                      {(["hot", "warm", "cool", "cold"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => setTemperature(t)}
                          className="rounded-lg px-4 py-2 text-[13px] font-medium transition-all cursor-pointer border"
                          style={{
                            background: temperature === t ? TEMP_CONFIG[t].bg : "transparent",
                            color: temperature === t ? TEMP_CONFIG[t].color : "var(--neutral-500)",
                            borderColor: temperature === t ? TEMP_CONFIG[t].color : "var(--neutral-700)",
                          }}
                        >
                          {TEMP_CONFIG[t].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Agreed next step */}
                  <div className="mb-5">
                    <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-2">Agreed next step</div>
                    <input
                      type="text"
                      value={agreedNextStep}
                      onChange={e => setAgreedNextStep(e.target.value)}
                      placeholder="e.g. Send proposal by Friday"
                      className="w-full rounded-lg px-3 py-2.5 text-[14px] bg-[color:var(--surface-3)] text-[color:var(--neutral-100)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none placeholder:text-[color:var(--neutral-600)]"
                    />
                  </div>

                  {/* Follow-up date */}
                  <div className="mb-5">
                    <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-2">Follow-up date</div>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                      className="rounded-lg px-3 py-2.5 text-[14px] bg-[color:var(--surface-3)] text-[color:var(--neutral-100)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none"
                    />
                  </div>

                  {/* Blockers */}
                  <div className="mb-6">
                    <div className="text-[11px] uppercase tracking-wider text-[color:var(--neutral-500)] mb-2">Any blockers or concerns?</div>
                    <textarea
                      value={blockers}
                      onChange={e => setBlockers(e.target.value)}
                      placeholder="Optional"
                      rows={2}
                      className="w-full rounded-lg px-3 py-2.5 text-[14px] bg-[color:var(--surface-3)] text-[color:var(--neutral-100)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none resize-none placeholder:text-[color:var(--neutral-600)]"
                    />
                  </div>

                  <button
                    onClick={handleSubmitDebrief}
                    disabled={loading || !temperature}
                    className="w-full rounded-xl py-3 text-[15px] font-semibold cursor-pointer disabled:opacity-50 transition-all"
                    style={{
                      background: temperature ? "var(--accent-cta)" : "var(--surface-3)",
                      color: temperature ? "var(--accent-cta-fg)" : "var(--neutral-500)",
                    }}
                  >
                    {loading ? "Generating summary..." : "Generate Summary"}
                  </button>
                </div>
              </div>
            ) : (
              <SynthesisView
                data={synthesisData}
                dealId={deal.id}
                loading={loading}
                onComplete={handleComplete}
                onTransitionStage={handleTransitionStage}
              />
            )}
          </motion.div>
        )}

        {/* COMPLETE — redirect handled, but just in case */}
        {status === "complete" && synthesisData && (
          <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <SynthesisView
              data={synthesisData}
              dealId={deal.id}
              loading={false}
              onComplete={() => router.push(`/lite/admin/pipeline/${deal.id}`)}
              onTransitionStage={handleTransitionStage}
              completed
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TalkingPointsCard({ points }: { points: string[] }) {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div className="mb-6 rounded-xl border border-[color:var(--brand-pink)]/20 bg-[rgba(244,160,176,0.04)] p-4">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="flex items-center justify-between w-full text-left cursor-pointer"
      >
        <span className="text-[11px] uppercase tracking-wider text-[color:var(--brand-pink)] font-medium">Talking Points</span>
        <span className="text-[color:var(--neutral-500)] text-[12px]">{collapsed ? "Show" : "Hide"}</span>
      </button>
      {!collapsed && (
        <ul className="mt-3 space-y-1.5">
          {points.map((p, i) => (
            <li key={i} className="text-[13px] text-[color:var(--neutral-300)] flex gap-2">
              <span className="text-[color:var(--brand-pink)] font-medium">{i + 1}.</span>
              {p}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CallSection({
  section,
  index,
  sectionsData,
  customQuestions,
  onUpdate,
}: {
  section: { id: string; title: string; questions: { id: string; text: string; boldPhrase?: string; signals: { level: string; text: string }[] }[] };
  index: number;
  sectionsData: SectionsState;
  customQuestions: { targetSection: string; text: string; boldPhrase?: string; signals: { level: string; text: string }[] }[];
  onUpdate: (id: string, field: "checked" | "notes", value: boolean | string) => void;
}) {
  const [open, setOpen] = React.useState(index === 0);
  const sectionCovered = section.questions.filter(q => sectionsData[q.id]?.checked).length;
  const injected = customQuestions.filter(q => q.targetSection === section.title);

  return (
    <motion.div
      className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] overflow-hidden"
      style={{ boxShadow: "var(--surface-highlight)" }}
      layout
      transition={HOUSE_SPRING}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 text-left cursor-pointer transition-colors hover:bg-[color:var(--surface-2)]"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[color:var(--brand-red)]/15 text-[color:var(--brand-pink)] text-[12px] font-semibold">
            {index + 1}
          </span>
          <h3 className="font-[family-name:var(--font-label)] text-[16px] text-[color:var(--neutral-100)]">
            {section.title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[color:var(--neutral-500)]">
            {sectionCovered}/{section.questions.length}
          </span>
          <motion.span
            className="text-[color:var(--neutral-500)] text-[12px]"
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            &#9654;
          </motion.span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {section.questions.map(q => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  checked={sectionsData[q.id]?.checked ?? false}
                  notes={sectionsData[q.id]?.notes ?? ""}
                  onUpdate={onUpdate}
                />
              ))}

              {/* LLM-injected custom questions */}
              {injected.map((q, i) => (
                <QuestionCard
                  key={`custom-${i}`}
                  question={{ id: `custom-${section.id}-${i}`, text: q.text, boldPhrase: q.boldPhrase, signals: q.signals }}
                  checked={sectionsData[`custom-${section.id}-${i}`]?.checked ?? false}
                  notes={sectionsData[`custom-${section.id}-${i}`]?.notes ?? ""}
                  onUpdate={onUpdate}
                  isCustom
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const SIGNAL_COLORS: Record<string, string> = {
  green: "var(--success)",
  amber: "var(--warning)",
  red: "var(--error)",
};

function QuestionCard({
  question,
  checked,
  notes,
  onUpdate,
  isCustom,
}: {
  question: { id: string; text: string; boldPhrase?: string; signals: { level: string; text: string }[] };
  checked: boolean;
  notes: string;
  onUpdate: (id: string, field: "checked" | "notes", value: boolean | string) => void;
  isCustom?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4 transition-all"
      style={{
        background: "var(--surface-2)",
        borderColor: isCustom
          ? "rgba(244, 160, 176, 0.25)"
          : checked
            ? "var(--success)"
            : "var(--neutral-700)",
        opacity: checked ? 0.7 : 1,
      }}
    >
      <div className="flex gap-3">
        <button
          onClick={() => onUpdate(question.id, "checked", !checked)}
          className="flex-shrink-0 w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center cursor-pointer transition-all"
          style={{
            background: checked ? "var(--success)" : "var(--surface-0)",
            borderColor: checked ? "var(--success)" : "var(--neutral-600)",
          }}
        >
          {checked && <span className="text-[11px] font-bold" style={{ color: "var(--surface-0)" }}>&#10003;</span>}
        </button>
        <div className="flex-1">
          <p className={`text-[14px] leading-relaxed ${checked ? "line-through text-[color:var(--neutral-500)]" : "text-[color:var(--neutral-200)]"}`}>
            {question.boldPhrase ? (
              <>
                {question.text.split(question.boldPhrase)[0]}
                <strong className="text-[color:var(--neutral-100)]">{question.boldPhrase}</strong>
                {question.text.split(question.boldPhrase).slice(1).join(question.boldPhrase)}
              </>
            ) : question.text}
          </p>

          {isCustom && (
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-[color:var(--brand-pink)] font-medium">
              AI-generated
            </span>
          )}

          {/* Listen-for signals */}
          {question.signals.length > 0 && (
            <div className="mt-3 rounded-md p-3" style={{ background: "rgba(244, 160, 176, 0.04)", borderLeft: "3px solid var(--brand-pink)" }}>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--brand-pink)] font-medium mb-1.5">
                Listen for
              </div>
              <ul className="space-y-1">
                {question.signals.map((s, i) => (
                  <li key={i} className="text-[13px] text-[color:var(--neutral-300)] flex gap-2 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SIGNAL_COLORS[s.level] ?? "var(--neutral-500)" }} />
                    {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => onUpdate(question.id, "notes", e.target.value)}
            placeholder="Notes..."
            rows={1}
            className="mt-3 w-full rounded-md px-3 py-2 text-[13px] bg-[color:var(--surface-0)] text-[color:var(--neutral-100)] border border-[color:var(--neutral-700)] focus:border-[color:var(--brand-pink)] focus:outline-none resize-y placeholder:text-[color:var(--neutral-600)]"
            style={{ minHeight: "40px" }}
          />
        </div>
      </div>
    </div>
  );
}

function SynthesisView({
  data,
  dealId,
  loading,
  onComplete,
  onTransitionStage,
  completed,
}: {
  data: { summary?: string; nextActions?: { text: string; actionType: string; actionData?: Record<string, string> }[]; stageRecommendation?: { shouldMove: boolean; targetStage?: string; reason?: string }; flags?: string[] } | null;
  dealId: string;
  loading: boolean;
  onComplete: () => void;
  onTransitionStage: (stage: string) => void;
  completed?: boolean;
}) {
  const router = useRouter();

  function handleAction(action: { actionType: string; actionData?: Record<string, string> }) {
    switch (action.actionType) {
      case "open_quote_builder":
        router.push(`/lite/admin/deals/${dealId}/quotes/new`);
        break;
      case "transition_stage":
        if (action.actionData?.stage) onTransitionStage(action.actionData.stage);
        break;
      case "navigate":
        break;
      default:
        break;
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6" style={{ boxShadow: "var(--surface-highlight)" }}>
        <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--brand-pink)] mb-3">Call Summary</h2>
        <p className="text-[14px] text-[color:var(--neutral-300)] leading-relaxed">{data?.summary}</p>
      </div>

      {/* Next actions */}
      {data?.nextActions && data.nextActions.length > 0 && (
        <div className="rounded-xl border border-[color:var(--neutral-700)] bg-[color:var(--surface-1)] p-6" style={{ boxShadow: "var(--surface-highlight)" }}>
          <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--brand-pink)] mb-3">Next Actions</h2>
          <div className="space-y-2">
            {data.nextActions.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[color:var(--surface-2)] p-3 border border-[color:var(--neutral-700)]">
                <span className="text-[14px] text-[color:var(--neutral-200)]">{a.text}</span>
                {a.actionType !== "manual" && (
                  <button
                    onClick={() => handleAction(a)}
                    className="rounded-md px-3 py-1.5 text-[12px] font-medium cursor-pointer transition-colors"
                    style={{
                      background: "rgba(244, 160, 176, 0.1)",
                      color: "var(--brand-pink)",
                      border: "1px solid rgba(244, 160, 176, 0.2)",
                    }}
                  >
                    {a.actionType === "open_quote_builder" ? "Open Quote Builder" :
                     a.actionType === "transition_stage" ? `Move to ${a.actionData?.stage?.replace("_", " ")}` :
                     a.actionType === "set_followup" ? "Set Follow-up" :
                     "Go"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage recommendation */}
      {data?.stageRecommendation?.shouldMove && data.stageRecommendation.targetStage && (
        <div className="rounded-xl border border-[color:var(--brand-pink)]/20 bg-[rgba(244,160,176,0.04)] p-6">
          <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--brand-pink)] mb-2">Stage Recommendation</h2>
          <p className="text-[14px] text-[color:var(--neutral-300)] mb-3">{data.stageRecommendation.reason}</p>
          <button
            onClick={() => onTransitionStage(data.stageRecommendation!.targetStage!)}
            className="rounded-lg px-4 py-2 text-[13px] font-medium cursor-pointer transition-all"
            style={{
              background: "var(--accent-cta)",
              color: "var(--accent-cta-fg)",
            }}
          >
            Move to {data.stageRecommendation.targetStage.replace("_", " ")}
          </button>
        </div>
      )}

      {/* Flags */}
      {data?.flags && data.flags.length > 0 && (
        <div className="rounded-xl border border-[color:var(--brand-orange)]/20 bg-[rgba(242,140,82,0.04)] p-6">
          <h2 className="font-[family-name:var(--font-label)] text-[14px] text-[color:var(--brand-orange)] mb-2">Flags</h2>
          <ul className="space-y-1.5">
            {data.flags.map((f, i) => (
              <li key={i} className="text-[14px] text-[color:var(--neutral-300)] flex gap-2">
                <span className="text-[color:var(--brand-orange)]">&#9888;</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Complete button */}
      {!completed && (
        <div className="text-center pt-4">
          <button
            onClick={onComplete}
            disabled={loading}
            className="rounded-xl px-10 py-3 text-[15px] font-semibold cursor-pointer disabled:opacity-50 transition-all"
            style={{
              background: "var(--accent-cta)",
              color: "var(--accent-cta-fg)",
            }}
          >
            {loading ? "Completing..." : "Complete & Return to Deal"}
          </button>
        </div>
      )}
    </div>
  );
}
