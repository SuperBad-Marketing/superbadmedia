"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronDown,
  Check,
  AlertTriangle,
  Circle,
  Clock,
  Pencil,
  RefreshCw,
  X,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

import type { BusinessProfileSectionRow } from "@/lib/db/schema/business-profile-sections";
import type { BusinessProfileSuggestionRow } from "@/lib/db/schema/business-profile-suggestions";
import {
  saveSectionAction,
  saveProseAction,
  regenerateProseAction,
  approveSuggestionAction,
  dismissSuggestionAction,
  approveBrandDnaAction,
  discardBrandDnaDraftAction,
  populateProfileAction,
} from "./actions";
import { retakeAssessment } from "@/app/lite/brand-dna/actions";

const houseSpring = { type: "spring" as const, stiffness: 220, damping: 25, mass: 1 };

const SECTION_META: Record<
  string,
  { label: string; description: string; order: number }
> = {
  identity: {
    label: "Identity",
    description: "Business name, founder, location, tagline",
    order: 0,
  },
  services: {
    label: "Services",
    description: "Offerings, pricing, billing cadence",
    order: 1,
  },
  audience: {
    label: "Audience",
    description: "Who you serve, geography, ideal traits",
    order: 2,
  },
  positioning: {
    label: "Positioning",
    description: "One-liner, differentiators, philosophy",
    order: 3,
  },
  current_focus: {
    label: "Current Focus",
    description: "This quarter, growth priorities, active campaigns",
    order: 4,
  },
  social_proof: {
    label: "Social Proof",
    description: "Client outcomes, case studies, testimonials",
    order: 5,
  },
  origin_story: {
    label: "Origin Story",
    description: "How and why SuperBad started",
    order: 6,
  },
  external_design_rules: {
    label: "External Design Rules",
    description: "Colours, typography, visual style for client-facing assets",
    order: 7,
  },
  internal_design_rules: {
    label: "Internal Design Rules",
    description: "Admin UI patterns, motion tokens, page chrome",
    order: 8,
  },
  voice_rules: {
    label: "Voice Rules",
    description: "Tone, banned words, humour, register per surface",
    order: 9,
  },
};

const ALL_SECTION_KEYS = Object.keys(SECTION_META).sort(
  (a, b) => SECTION_META[a].order - SECTION_META[b].order,
);

type SectionHealth = "complete" | "stale" | "empty";

function getSectionHealth(
  section: BusinessProfileSectionRow | undefined,
): SectionHealth {
  if (!section) return "empty";
  const ageMs = Date.now() - section.updated_at_ms;
  if (ageMs > 90 * 24 * 60 * 60 * 1000) return "stale";
  return "complete";
}

function HealthDot({ health }: { health: SectionHealth }) {
  if (health === "complete")
    return <Check size={14} className="text-[#7BAE7E]" />;
  if (health === "stale")
    return <AlertTriangle size={14} className="text-[color:var(--color-brand-orange)]" />;
  return <Circle size={14} className="text-[color:var(--color-neutral-500)]" />;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

type BrandDnaSnapshot = {
  id: string;
  prose_portrait: string | null;
  signal_tags: string | null;
  status: string;
} | null;

type DraftBrandDna = {
  id: string;
  prose_portrait: string | null;
  first_impression: string | null;
  signal_tags: string | null;
  status: string;
  updated_at_ms: number;
} | null;

interface ProfileDashboardProps {
  initialSections: BusinessProfileSectionRow[];
  brandDna: BrandDnaSnapshot;
  draftBrandDna: DraftBrandDna;
  initialSuggestions: BusinessProfileSuggestionRow[];
}

export function ProfileDashboard({
  initialSections,
  brandDna,
  draftBrandDna,
  initialSuggestions,
}: ProfileDashboardProps) {
  const router = useRouter();
  const [isPopulating, startPopulate] = useTransition();
  const sectionMap = new Map(
    initialSections.map((s) => [s.section_key, s]),
  );

  const completeSections = ALL_SECTION_KEYS.filter(
    (k) => getSectionHealth(sectionMap.get(k)) === "complete",
  );
  const hasBrandDna = brandDna?.status === "complete" && !!brandDna.prose_portrait;

  function handlePopulate() {
    startPopulate(async () => {
      const result = await populateProfileAction();
      if (result.ok) {
        toast.success(`Populated ${result.sectionsPopulated} sections.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-16">
      {isPopulating && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="mb-4 flex items-center gap-3 rounded-lg border p-4"
          style={{
            backgroundColor: "rgba(244,160,176,0.08)",
            borderColor: "var(--color-brand-pink)",
          }}
        >
          <RefreshCw size={16} className="animate-spin text-[color:var(--color-brand-pink)]" />
          <span className="text-[14px] text-[color:var(--color-neutral-300)]">
            Populating profile sections and generating prose summaries...
          </span>
        </motion.div>
      )}

      {/* Health snapshot */}
      <HealthSnapshot
        sectionMap={sectionMap}
        completeSections={completeSections}
        hasBrandDna={hasBrandDna}
        pendingSuggestions={initialSuggestions.length}
        onPopulate={handlePopulate}
      />

      {/* Brand DNA card */}
      <BrandDnaCard brandDna={brandDna} draftBrandDna={draftBrandDna} router={router} />

      {/* Section cards */}
      <div className="mt-6 space-y-3">
        {ALL_SECTION_KEYS.map((key) => (
          <SectionCard
            key={key}
            sectionKey={key}
            section={sectionMap.get(key)}
            router={router}
          />
        ))}
      </div>

      {/* Suggestion queue */}
      {initialSuggestions.length > 0 && (
        <SuggestionQueue suggestions={initialSuggestions} router={router} />
      )}
    </div>
  );
}

function HealthSnapshot({
  sectionMap,
  completeSections,
  hasBrandDna,
  pendingSuggestions,
  onPopulate,
}: {
  sectionMap: Map<string, BusinessProfileSectionRow>;
  completeSections: string[];
  hasBrandDna: boolean;
  pendingSuggestions: number;
  onPopulate: () => void;
}) {
  const emptySections = ALL_SECTION_KEYS.length - completeSections.length;
  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: "var(--color-surface-3)",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
            Profile Health
          </div>
          <div className="mt-1 font-[family-name:var(--font-display)] text-[24px] text-[color:var(--color-brand-cream)]">
            {completeSections.length} of {ALL_SECTION_KEYS.length} sections current
          </div>
        </div>
        {pendingSuggestions > 0 && (
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium" style={{ backgroundColor: "rgba(242,140,82,0.15)", color: "var(--color-brand-orange)" }}>
            <Sparkles size={12} />
            {pendingSuggestions} pending
          </div>
        )}
      </div>

      {emptySections > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onPopulate}
            className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-colors cursor-pointer"
            style={{
              letterSpacing: "1px",
              backgroundColor: "var(--color-brand-red)",
              color: "var(--color-brand-cream)",
            }}
          >
            <Sparkles size={12} />
            Populate {emptySections === ALL_SECTION_KEYS.length ? "all" : "empty"} sections
          </button>
          <p className="mt-1.5 text-[11px] text-[color:var(--color-neutral-500)]">
            Pulls from Brand DNA, products, and known business facts. Won&apos;t overwrite existing sections.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {hasBrandDna && (
          <div className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px]" style={{ backgroundColor: "rgba(123,174,126,0.12)", color: "#7BAE7E" }}>
            <Check size={12} />
            Brand DNA
          </div>
        )}
        {ALL_SECTION_KEYS.map((key) => {
          const health = getSectionHealth(sectionMap.get(key));
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-[11px]"
              style={{
                backgroundColor:
                  health === "complete"
                    ? "rgba(123,174,126,0.12)"
                    : health === "stale"
                      ? "rgba(242,140,82,0.12)"
                      : "rgba(128,127,115,0.12)",
                color:
                  health === "complete"
                    ? "#7BAE7E"
                    : health === "stale"
                      ? "var(--color-brand-orange)"
                      : "var(--color-neutral-500)",
              }}
            >
              <HealthDot health={health} />
              {SECTION_META[key]?.label ?? key}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function parseTags(signalTags: string | null): string[] {
  if (!signalTags) return [];
  try {
    const parsed = JSON.parse(signalTags) as Record<string, unknown>;
    return Object.keys(parsed).slice(0, 8);
  } catch {
    return [];
  }
}

function BrandDnaCard({
  brandDna,
  draftBrandDna,
  router,
}: {
  brandDna: BrandDnaSnapshot;
  draftBrandDna: DraftBrandDna;
  router: ReturnType<typeof useRouter>;
}) {
  const [isPending, startTransition] = useTransition();
  const hasProse = brandDna?.status === "complete" && !!brandDna.prose_portrait;
  const hasDraft = !!draftBrandDna?.prose_portrait;

  const liveTags = parseTags(brandDna?.signal_tags ?? null);
  const draftTags = parseTags(draftBrandDna?.signal_tags ?? null);

  function onApprove() {
    if (!draftBrandDna) return;
    startTransition(async () => {
      const res = await approveBrandDnaAction(draftBrandDna.id);
      if (res.ok) {
        toast.success("Brand DNA approved — now live across all AI features.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDiscard() {
    if (!draftBrandDna) return;
    startTransition(async () => {
      const res = await discardBrandDnaDraftAction(draftBrandDna.id);
      if (res.ok) {
        toast.success("Draft discarded.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Draft awaiting approval */}
      {hasDraft && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="rounded-lg border-2 p-4"
          style={{
            backgroundColor: "var(--color-surface-1)",
            borderColor: "var(--color-brand-orange)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-orange)]" style={{ letterSpacing: "1.5px" }}>
              Brand Personality — Draft
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[color:var(--color-brand-orange)]">
              <Clock size={12} />
              Awaiting approval
            </div>
          </div>

          <p className="mt-2 text-[13px] text-[color:var(--color-neutral-400)]">
            This will replace your current brand personality across every AI feature when approved.
          </p>

          {draftBrandDna.first_impression && (
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[15px] italic leading-[1.6] text-[color:var(--color-brand-pink)]">
              {draftBrandDna.first_impression}
            </p>
          )}

          <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-neutral-300)]">
            {draftBrandDna.prose_portrait}
          </p>

          {draftTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {draftTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: "rgba(242,140,82,0.12)",
                    color: "var(--color-brand-orange)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onApprove}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-opacity disabled:opacity-50"
              style={{
                letterSpacing: "1px",
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
              }}
            >
              <Check size={12} />
              {isPending ? "Approving..." : "Approve & go live"}
            </button>
            <button
              onClick={onDiscard}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-opacity disabled:opacity-50"
              style={{
                letterSpacing: "1px",
                backgroundColor: "transparent",
                color: "var(--color-neutral-400)",
                border: "1px solid var(--color-neutral-600)",
              }}
            >
              <X size={12} />
              Discard
            </button>
          </div>
        </motion.div>
      )}

      {/* Live / empty state */}
      <div
        className="rounded-lg border p-4"
        style={{
          backgroundColor: "var(--color-surface-1)",
          borderColor: "var(--color-surface-3)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
            Brand Personality{hasProse ? " — Live" : ""}
          </div>
          {hasProse ? (
            <div className="flex items-center gap-1 text-[11px] text-[#7BAE7E]">
              <Check size={12} />
              Active
            </div>
          ) : (
            <div className="text-[11px] text-[color:var(--color-neutral-500)]">
              Not yet assessed
            </div>
          )}
        </div>

        {hasProse ? (
          <>
            <p className="mt-3 text-[14px] leading-[1.6] text-[color:var(--color-neutral-300)]">
              {brandDna!.prose_portrait!.slice(0, 300)}
              {brandDna!.prose_portrait!.length > 300 && "..."}
            </p>
            {liveTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {liveTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: "rgba(244,160,176,0.12)",
                      color: "var(--color-brand-pink)",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4">
              <form action={retakeAssessment}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-[family-name:var(--font-label)] uppercase transition-colors cursor-pointer"
                  style={{
                    letterSpacing: "1px",
                    backgroundColor: "rgba(244,160,176,0.1)",
                    color: "var(--color-brand-pink)",
                  }}
                >
                  <RefreshCw size={12} />
                  Retake assessment
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-[14px] text-[color:var(--color-neutral-500)]">
              Take the Brand DNA assessment to generate your brand personality
              profile. This feeds into every AI-generated communication.
            </p>
            <div className="mt-4">
              <Link
                href="/lite/brand-dna"
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-[family-name:var(--font-label)] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  backgroundColor: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                }}
              >
                <Sparkles size={12} />
                Take assessment
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  sectionKey,
  section,
  router,
}: {
  sectionKey: string;
  section: BusinessProfileSectionRow | undefined;
  router: ReturnType<typeof useRouter>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingProse, setEditingProse] = useState(false);
  const [isPending, startTransition] = useTransition();
  const meta = SECTION_META[sectionKey];
  const health = getSectionHealth(section);

  const structured =
    section?.structured_data && typeof section.structured_data === "object"
      ? (section.structured_data as Record<string, unknown>)
      : null;

  const hasContent = !!structured && Object.keys(structured).length > 0;

  return (
    <div
      className="rounded-lg border transition-colors duration-[180ms]"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderColor: expanded
          ? "var(--color-brand-pink)"
          : "var(--color-surface-3)",
      }}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <HealthDot health={health} />
        <div className="flex-1">
          <div className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
            {meta?.label ?? sectionKey}
          </div>
          <div className="text-[12px] text-[color:var(--color-neutral-500)]">
            {meta?.description}
          </div>
        </div>
        {section && (
          <div className="text-[11px] text-[color:var(--color-neutral-500)]">
            {formatRelativeTime(section.updated_at_ms)}
          </div>
        )}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={houseSpring}
        >
          <ChevronDown size={16} className="text-[color:var(--color-neutral-500)]" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={houseSpring}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--color-surface-3)" }}>
              {editing ? (
                <SectionEditor
                  sectionKey={sectionKey}
                  existing={structured}
                  onDone={() => {
                    setEditing(false);
                    router.refresh();
                  }}
                />
              ) : (
                <>
                  {/* Structured data display */}
                  {hasContent ? (
                    <div className="space-y-1.5">
                      {Object.entries(structured!).map(([field, value]) => (
                        <div key={field} className="flex gap-2 text-[13px]">
                          <span className="shrink-0 text-[color:var(--color-neutral-500)]">
                            {formatFieldLabel(field)}:
                          </span>
                          <span className="text-[color:var(--color-neutral-300)]">
                            {formatFieldValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] italic text-[color:var(--color-neutral-500)]">
                      No data yet. Click Edit to add content.
                    </p>
                  )}

                  {/* Prose summary */}
                  {section?.prose_summary && !editingProse && (
                    <div className="mt-3 rounded border p-3" style={{ borderColor: "var(--color-surface-3)", backgroundColor: "var(--color-surface-0)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
                          Prose Summary
                          {section.prose_manually_edited && (
                            <span className="ml-2 text-[color:var(--color-brand-pink)]">(hand-edited)</span>
                          )}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
                        {section.prose_summary}
                      </p>
                    </div>
                  )}

                  {/* Prose editor */}
                  {editingProse && section && (
                    <ProseEditor
                      sectionKey={sectionKey}
                      currentProse={section.prose_summary ?? ""}
                      onDone={() => {
                        setEditingProse(false);
                        router.refresh();
                      }}
                    />
                  )}

                  {/* Action buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-cream)] transition-colors duration-[180ms]"
                      style={{ backgroundColor: "var(--color-surface-2)" }}
                    >
                      <Pencil size={12} />
                      Edit
                    </button>

                    {hasContent && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await regenerateProseAction(sectionKey);
                            router.refresh();
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-neutral-300)] transition-colors duration-[180ms] disabled:opacity-50"
                        style={{ backgroundColor: "var(--color-surface-2)" }}
                      >
                        <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
                        {isPending ? "Generating..." : "Regenerate prose"}
                      </button>
                    )}

                    {section?.prose_summary && !editingProse && (
                      <button
                        type="button"
                        onClick={() => setEditingProse(true)}
                        className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-neutral-300)] transition-colors duration-[180ms]"
                        style={{ backgroundColor: "var(--color-surface-2)" }}
                      >
                        <Pencil size={12} />
                        Edit prose
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionEditor({
  sectionKey,
  existing,
  onDone,
}: {
  sectionKey: string;
  existing: Record<string, unknown> | null;
  onDone: () => void;
}) {
  const [json, setJson] = useState(
    existing ? JSON.stringify(existing, null, 2) : "{\n  \n}",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      setError("Invalid JSON. Check your syntax.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveSectionAction(sectionKey, parsed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div>
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={12}
        className="w-full rounded border p-3 font-mono text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "var(--color-surface-0)",
          borderColor: error ? "var(--color-brand-red)" : "var(--color-surface-3)",
        }}
      />
      {error && (
        <p className="mt-1 text-[12px] text-[color:var(--color-brand-red)]">{error}</p>
      )}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-cream)] disabled:opacity-50"
          style={{ backgroundColor: "var(--color-brand-red)" }}
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-neutral-300)]"
          style={{ backgroundColor: "var(--color-surface-2)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function ProseEditor({
  sectionKey,
  currentProse,
  onDone,
}: {
  sectionKey: string;
  currentProse: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(currentProse);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await saveProseAction(sectionKey, text);
      onDone();
    });
  }

  return (
    <div className="mt-3">
      <div className="text-[11px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
        Edit Prose Summary
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="mt-1.5 w-full rounded border p-3 text-[13px] text-[color:var(--color-brand-cream)] focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "var(--color-surface-0)",
          borderColor: "var(--color-surface-3)",
        }}
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-brand-cream)] disabled:opacity-50"
          style={{ backgroundColor: "var(--color-brand-red)" }}
        >
          {isPending ? "Saving..." : "Save prose"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-[12px] font-medium text-[color:var(--color-neutral-300)]"
          style={{ backgroundColor: "var(--color-surface-2)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SuggestionQueue({
  suggestions,
  router,
}: {
  suggestions: BusinessProfileSuggestionRow[];
  router: ReturnType<typeof useRouter>;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mt-8">
      <div
        className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Pending Suggestions
      </div>
      <div className="mt-3 space-y-2">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-start gap-3 rounded-lg border p-3"
            style={{
              backgroundColor: "var(--color-surface-1)",
              borderColor: "var(--color-surface-3)",
            }}
          >
            <Sparkles size={14} className="mt-0.5 shrink-0 text-[color:var(--color-brand-orange)]" />
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                {s.title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[color:var(--color-neutral-500)]">
                <span className="rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--color-surface-2)" }}>
                  {s.source}
                </span>
                <span>{s.suggestion_type}</span>
                <span>{formatRelativeTime(s.created_at_ms)}</span>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await approveSuggestionAction(s.id);
                    router.refresh();
                  })
                }
                className="rounded p-1.5 text-[#7BAE7E] transition-colors hover:bg-[rgba(123,174,126,0.15)] disabled:opacity-50"
                title="Approve"
              >
                <ThumbsUp size={14} />
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await dismissSuggestionAction(s.id);
                    router.refresh();
                  })
                }
                className="rounded p-1.5 text-[color:var(--color-neutral-500)] transition-colors hover:bg-[rgba(128,127,115,0.15)] disabled:opacity-50"
                title="Dismiss"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
