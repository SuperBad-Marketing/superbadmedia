"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, Check, X, Play, Zap, Battery, Minus } from "lucide-react";
import { houseSpring } from "@/lib/design-tokens";
import {
  type SessionPackRow,
  type ScriptRow,
  type EnergyLevel,
  ENERGY_LEVELS,
  pillarBySlug,
  type PillarSlug,
} from "@/lib/db/schema/talking-head";
import {
  generatePackAction,
  updateScriptStatusAction,
  updatePackEnergyAction,
} from "../actions";
import { TeleprompterModal } from "./teleprompter-modal";

const ENERGY_LABELS: Record<EnergyLevel, { label: string; icon: typeof Zap }> = {
  low_battery: { label: "Low Battery", icon: Battery },
  default: { label: "Default", icon: Minus },
  feeling_it: { label: "Feeling It", icon: Zap },
};

const FORMAT_LABELS = { short: "Short", mid: "Mid" } as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function ScriptStudioClient({
  initialPack,
  initialScripts,
}: {
  initialPack: SessionPackRow | null;
  initialScripts: ScriptRow[];
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [pack, setPack] = useState(initialPack);
  const [scripts, setScripts] = useState(initialScripts);
  const [generating, startGenerate] = useTransition();
  const [energy, setEnergy] = useState<EnergyLevel>(
    initialPack?.energy_level ?? "default",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prompterScript, setPrompterScript] = useState<ScriptRow | null>(null);

  function handleGenerate() {
    startGenerate(async () => {
      const result = await generatePackAction(energy, 4);
      setPack(result.pack);
      setScripts(result.scripts);
      router.refresh();
    });
  }

  async function handleStatusChange(
    scriptId: string,
    status: "approved" | "skipped",
  ) {
    await updateScriptStatusAction(scriptId, status);
    setScripts((prev) =>
      prev.map((s) => (s.id === scriptId ? { ...s, status } : s)),
    );
  }

  async function handleEnergyChange(level: EnergyLevel) {
    setEnergy(level);
    if (pack) {
      await updatePackEnergyAction(pack.id, level);
    }
  }

  const approvedCount = scripts.filter((s) => s.status === "approved" || s.status === "filmed").length;
  const totalCount = scripts.filter((s) => s.status !== "skipped").length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <motion.div
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: reducedMotion ? 0 : 0.08 }}
      >
        {/* Header */}
        <motion.header
          className="px-4 pt-6 pb-5"
          variants={reducedMotion ? undefined : sectionVariants}
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        >
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Content{" "}
            <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
            <span className="text-[color:var(--color-brand-pink)]">
              Script Studio
            </span>
          </div>
          <h1
            className="mt-3 text-balance font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Script Studio
          </h1>
          <p className="mt-3 max-w-[640px] text-pretty font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
            Talking head scripts for the armchair.{" "}
            <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
              sit down, read the words, get up.
            </em>
          </p>
        </motion.header>

        {/* Energy selector */}
        <motion.div
          className="mt-6 px-4"
          variants={reducedMotion ? undefined : sectionVariants}
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        >
          <div
            className="mb-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Energy Level
          </div>
          <div className="flex gap-2">
            {ENERGY_LEVELS.map((level) => {
              const { label, icon: Icon } = ENERGY_LABELS[level];
              const isActive = energy === level;
              return (
                <button
                  key={level}
                  onClick={() => handleEnergyChange(level)}
                  className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-[family-name:var(--font-body)] transition-all duration-150 ease-out"
                  style={{
                    backgroundColor: isActive
                      ? "var(--color-surface-2)"
                      : "var(--color-surface-1)",
                    color: isActive
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                    border: isActive
                      ? "1px solid rgba(253, 245, 230, 0.08)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                  {label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Session pack */}
        <motion.div
          className="mt-8 px-4"
          variants={reducedMotion ? undefined : sectionVariants}
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        >
          {!pack ? (
            <EmptyState generating={generating} onGenerate={handleGenerate} />
          ) : (
            <div>
              {/* Pack header */}
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
                    style={{ letterSpacing: "2px" }}
                  >
                    Session Pack
                  </span>
                  {totalCount > 0 && (
                    <span className="text-[12px] font-[family-name:var(--font-body)] tabular-nums text-[color:var(--color-neutral-500)]">
                      {approvedCount}/{totalCount} approved
                    </span>
                  )}
                </div>
                {allApproved && (
                  <span className="flex items-center gap-1.5 rounded-full bg-[color:var(--color-semantic-success)] bg-opacity-15 px-3 py-1 text-[11px] font-[family-name:var(--font-label)] uppercase text-[color:var(--color-semantic-success)]" style={{ letterSpacing: "1px" }}>
                    <Check size={12} strokeWidth={2} />
                    Ready to film
                  </span>
                )}
              </div>

              {/* Script cards */}
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {scripts
                    .filter((s) => s.status !== "skipped")
                    .map((script, i) => (
                      <motion.div
                        key={script.id}
                        layout
                        initial={
                          reducedMotion ? false : { opacity: 0, y: 12 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        exit={
                          reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }
                        }
                        transition={
                          reducedMotion ? { duration: 0 } : { ...houseSpring, delay: i * 0.04 }
                        }
                      >
                        <ScriptCard
                          script={script}
                          expanded={expandedId === script.id}
                          onToggle={() =>
                            setExpandedId(
                              expandedId === script.id ? null : script.id,
                            )
                          }
                          onApprove={() =>
                            handleStatusChange(script.id, "approved")
                          }
                          onSkip={() =>
                            handleStatusChange(script.id, "skipped")
                          }
                          onTeleprompter={() => setPrompterScript(script)}
                        />
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>

              {/* Generate new pack */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-[13px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out disabled:opacity-40"
                  style={{
                    letterSpacing: "1.5px",
                    backgroundColor: "var(--color-surface-2)",
                    color: "var(--color-neutral-400)",
                    border: "1px solid rgba(253, 245, 230, 0.04)",
                  }}
                >
                  {generating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : null}
                  {generating ? "Generating…" : "New Session Pack"}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Teleprompter overlay */}
      {prompterScript && (
        <TeleprompterModal
          script={prompterScript}
          onClose={() => setPrompterScript(null)}
          onFilmed={async () => {
            await updateScriptStatusAction(prompterScript.id, "filmed");
            setScripts((prev) =>
              prev.map((s) =>
                s.id === prompterScript.id ? { ...s, status: "filmed" } : s,
              ),
            );
            setPrompterScript(null);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div
      className="rounded-2xl px-8 py-16 text-center"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight), 0 4px 24px rgba(0,0,0,0.25)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <h2
        className="text-balance font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        No session pack yet.
      </h2>
      <p className="mt-3 font-[family-name:var(--font-narrative)] text-[16px] italic text-[color:var(--color-neutral-500)]">
        Generate one and sit in the chair.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[14px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out disabled:opacity-50"
        style={{
          letterSpacing: "1.5px",
          backgroundColor: "var(--color-brand-red)",
          color: "var(--color-brand-cream)",
        }}
      >
        {generating ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating scripts…
          </>
        ) : (
          "Generate Session Pack"
        )}
      </button>
    </div>
  );
}

function ScriptCard({
  script,
  expanded,
  onToggle,
  onApprove,
  onSkip,
  onTeleprompter,
}: {
  script: ScriptRow;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onSkip: () => void;
  onTeleprompter: () => void;
}) {
  const pillar = pillarBySlug(script.pillar_slug as PillarSlug);
  const isApproved = script.status === "approved" || script.status === "filmed";
  const isFilmed = script.status === "filmed";
  const reducedMotion = useReducedMotion();

  const scriptData = script.script_json as Record<string, unknown>;
  const editBrief = script.edit_brief_json as Record<string, unknown> | null;
  const publishMeta = script.publish_meta_json as Record<string, unknown> | null;

  return (
    <div
      className="overflow-hidden rounded-xl transition-all duration-150 ease-out"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: isApproved
          ? "1px solid rgba(123, 174, 126, 0.2)"
          : "1px solid rgba(253, 245, 230, 0.04)",
      }}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="rounded-full px-2.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1px",
                backgroundColor: "rgba(242, 140, 82, 0.1)",
                color: "var(--color-brand-orange)",
              }}
            >
              {pillar.label}
            </span>
            <span
              className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "0.5px",
                backgroundColor: "var(--color-surface-1)",
                color: "var(--color-neutral-500)",
              }}
            >
              {FORMAT_LABELS[script.format as keyof typeof FORMAT_LABELS]}
            </span>
            <span className="text-[11px] tabular-nums text-[color:var(--color-neutral-600)]">
              ~{script.estimated_duration_sec}s
            </span>
          </div>
          <h3 className="text-[15px] font-[family-name:var(--font-body)] font-medium text-[color:var(--color-brand-cream)] truncate">
            {script.title}
          </h3>
          <p className="mt-0.5 text-[13px] font-[family-name:var(--font-body)] text-[color:var(--color-neutral-400)] truncate">
            {script.hook}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isFilmed && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-[family-name:var(--font-label)] uppercase text-[color:var(--color-semantic-success)]" style={{ letterSpacing: "0.5px", backgroundColor: "rgba(123,174,126,0.1)" }}>
              <Check size={10} strokeWidth={2} />
              Filmed
            </span>
          )}
          {isApproved && !isFilmed && (
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-[family-name:var(--font-label)] uppercase text-[color:var(--color-semantic-success)]" style={{ letterSpacing: "0.5px", backgroundColor: "rgba(123,174,126,0.1)" }}>
              <Check size={10} strokeWidth={2} />
              Approved
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5"
              style={{ borderTop: "1px solid rgba(253, 245, 230, 0.04)" }}
            >
              {/* Script preview */}
              <div className="mt-4">
                <div
                  className="mb-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Script
                </div>
                <ScriptPreview data={scriptData} format={script.format} />
              </div>

              {/* Edit brief */}
              {editBrief && (
                <div className="mt-5">
                  <div
                    className="mb-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    Edit Brief
                  </div>
                  <EditBriefPreview data={editBrief} />
                </div>
              )}

              {/* Publish meta */}
              {publishMeta && (
                <div className="mt-5">
                  <div
                    className="mb-2 font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{ letterSpacing: "1.5px" }}
                  >
                    Publishing
                  </div>
                  <PublishMetaPreview data={publishMeta} />
                </div>
              )}

              {/* Actions */}
              <div className="mt-5 flex items-center gap-3">
                {!isApproved && (
                  <>
                    <button
                      onClick={onApprove}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out"
                      style={{
                        letterSpacing: "1px",
                        backgroundColor: "rgba(123, 174, 126, 0.15)",
                        color: "var(--color-semantic-success)",
                      }}
                    >
                      <Check size={13} strokeWidth={2} />
                      Approve
                    </button>
                    <button
                      onClick={onSkip}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out"
                      style={{
                        letterSpacing: "1px",
                        backgroundColor: "var(--color-surface-1)",
                        color: "var(--color-neutral-500)",
                      }}
                    >
                      <X size={13} strokeWidth={2} />
                      Skip
                    </button>
                  </>
                )}
                {isApproved && (
                  <button
                    onClick={onTeleprompter}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-[family-name:var(--font-label)] uppercase transition-all duration-150 ease-out"
                    style={{
                      letterSpacing: "1px",
                      backgroundColor: "var(--color-brand-red)",
                      color: "var(--color-brand-cream)",
                    }}
                  >
                    <Play size={13} strokeWidth={2} />
                    Teleprompter
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScriptPreview({
  data,
  format,
}: {
  data: Record<string, unknown>;
  format: string;
}) {
  if (format === "short") {
    const blocks = (data.blocks ?? []) as Array<{
      text: string;
      cue: string | null;
    }>;
    return (
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <p key={i} className="text-[14px] leading-relaxed text-[color:var(--color-neutral-200)]">
            {block.text}
            {block.cue && (
              <span className="ml-2 text-[11px] italic text-[color:var(--color-brand-orange)]">
                [{block.cue.replace("_", " ")}]
              </span>
            )}
          </p>
        ))}
      </div>
    );
  }

  const segments = (data.segments ?? []) as Array<{
    number: number;
    duration_hint_sec: number;
    blocks: Array<{ text: string; cue: string | null }>;
    b_cam_after: boolean;
  }>;
  return (
    <div className="space-y-4">
      {segments.map((seg) => (
        <div key={seg.number}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] tabular-nums font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "0.5px" }}>
              Seg {seg.number}
            </span>
            <span className="text-[11px] tabular-nums text-[color:var(--color-neutral-600)]">
              ~{seg.duration_hint_sec}s
            </span>
            {seg.b_cam_after && (
              <span className="rounded-full bg-[color:var(--color-surface-1)] px-2 py-0.5 text-[9px] font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-pink)]" style={{ letterSpacing: "0.5px" }}>
                B cam
              </span>
            )}
          </div>
          <div className="space-y-1">
            {seg.blocks.map((block, j) => (
              <p key={j} className="text-[14px] leading-relaxed text-[color:var(--color-neutral-200)]">
                {block.text}
                {block.cue && (
                  <span className="ml-2 text-[11px] italic text-[color:var(--color-brand-orange)]">
                    [{block.cue.replace("_", " ")}]
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EditBriefPreview({ data }: { data: Record<string, unknown> }) {
  const thumbnail = data.thumbnail as { concept: string; style: string } | undefined;
  const bCamMoments = (data.b_cam_moments ?? []) as string[];
  const pacingNote = data.pacing_note as string | undefined;

  return (
    <div className="space-y-3 text-[13px] text-[color:var(--color-neutral-300)]">
      {thumbnail && (
        <div>
          <span className="text-[color:var(--color-neutral-500)]">Thumbnail:</span>{" "}
          {thumbnail.concept}
        </div>
      )}
      {bCamMoments.length > 0 && (
        <div>
          <span className="text-[color:var(--color-neutral-500)]">B cam:</span>{" "}
          {bCamMoments.join(" · ")}
        </div>
      )}
      {pacingNote && (
        <div>
          <span className="text-[color:var(--color-neutral-500)]">Pacing:</span>{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-neutral-400)]">
            {pacingNote}
          </em>
        </div>
      )}
    </div>
  );
}

function PublishMetaPreview({ data }: { data: Record<string, unknown> }) {
  const caption = data.caption as string | undefined;
  const hashtags = (data.hashtags ?? []) as string[];
  const platforms = (data.platforms ?? []) as string[];

  return (
    <div className="space-y-3 text-[13px] text-[color:var(--color-neutral-300)]">
      {caption && (
        <p className="text-pretty leading-relaxed">{caption}</p>
      )}
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hashtags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-[11px] text-[color:var(--color-brand-pink)]"
              style={{ backgroundColor: "rgba(244, 160, 176, 0.08)" }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      {platforms.length > 0 && (
        <div className="text-[11px] text-[color:var(--color-neutral-500)]">
          {platforms.map((p) => p.replace(/_/g, " ")).join(" · ")}
        </div>
      )}
    </div>
  );
}
