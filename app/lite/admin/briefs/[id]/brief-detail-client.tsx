"use client";

import * as React from "react";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Camera,
  ClipboardList,
  FileText,
  RefreshCw,
  Send,
  Loader2,
  AlertCircle,
  Wand2,
} from "lucide-react";
import type {
  StoryboardScene,
  ShotlistGroup,
  StoryboardChatMessage,
} from "@/lib/db/schema/brief-storyboards";
import {
  reviseStoryboardAction,
  generateStoryboardAction,
  regenerateStoryboardAction,
} from "./actions";

interface BriefData {
  id: string;
  brief_type: string;
  status: string;
  source: string;
  business_name: string;
  contact_name: string;
  contact_email: string;
  description: string;
  delivery_date_ms: number;
  project_title: string | null;
  brief_kind: string | null;
  style_references: string | null;
  key_messages: string | null;
  target_audience: string | null;
  deliverables_breakdown: string | null;
  location_details: string | null;
  talent_notes: string | null;
  budget_range: string | null;
  additional_notes: string | null;
  created_at_ms: number;
}

interface StoryboardData {
  id: string;
  status: string;
  scenes: StoryboardScene[];
  shotlist: ShotlistGroup[];
  chatHistory: StoryboardChatMessage[];
  errorMessage: string | null;
  generatedAtMs: number | null;
}

type Tab = "details" | "storyboard" | "shotlist";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "details", label: "Details", icon: FileText },
  { id: "storyboard", label: "Storyboard", icon: Camera },
  { id: "shotlist", label: "Shotlist", icon: ClipboardList },
];

const SPRING = { type: "spring" as const, stiffness: 500, damping: 35 };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

const SHOT_TYPE_LABELS: Record<string, string> = {
  wide: "Wide",
  medium: "Medium",
  close_up: "Close-up",
  detail: "Detail",
  aerial: "Aerial",
  pov: "POV",
};

const CAMERA_LABELS: Record<string, string> = {
  static: "Static",
  pan: "Pan",
  tilt: "Tilt",
  track: "Track",
  handheld: "Handheld",
  crane: "Crane",
  drone: "Drone",
};

export function BriefDetailClient({
  brief,
  storyboard: initialStoryboard,
}: {
  brief: BriefData;
  storyboard: StoryboardData | null;
}) {
  const [tab, setTab] = useState<Tab>("details");
  const [storyboard, setStoryboard] = useState(initialStoryboard);
  const [chatInput, setChatInput] = useState("");
  const [revising, setRevising] = useState(false);
  const [generating, setGenerating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  async function handleRevise() {
    if (!chatInput.trim() || revising) return;
    const msg = chatInput.trim();
    setChatInput("");
    setRevising(true);

    if (storyboard) {
      setStoryboard({
        ...storyboard,
        chatHistory: [
          ...storyboard.chatHistory,
          { role: "user", content: msg, timestamp_ms: Date.now() },
        ],
      });
    }

    const result = await reviseStoryboardAction(brief.id, msg);
    setRevising(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Storyboard updated.");
    window.location.reload();
  }

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateStoryboardAction(brief.id);
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Storyboard generation started.");
    setTimeout(() => window.location.reload(), 2000);
  }

  async function handleRegenerate() {
    setGenerating(true);
    const result = await regenerateStoryboardAction(brief.id);
    setGenerating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Regenerating storyboard…");
    setTimeout(() => window.location.reload(), 2000);
  }

  const showChat = tab === "storyboard" || tab === "shotlist";
  const hasStoryboard = storyboard && storyboard.status === "ready";

  return (
    <div className="px-4 pb-12">
      {/* Tab strip */}
      <div className="mb-6 flex gap-1 rounded-[8px] bg-[color:rgba(253,245,230,0.03)] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex cursor-pointer items-center gap-1.5 rounded-[6px] border-none px-3.5 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              tab === t.id
                ? "text-[color:var(--color-brand-cream)]"
                : "text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            }`}
            style={{ letterSpacing: "1.5px" }}
          >
            {tab === t.id && (
              <motion.div
                layoutId="brief-tab-bg"
                className="absolute inset-0 rounded-[6px] bg-[color:rgba(253,245,230,0.08)]"
                transition={SPRING}
              />
            )}
            <t.icon className="relative size-3.5" strokeWidth={1.5} />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={showChat && hasStoryboard ? "flex gap-5" : ""}>
        <div className={showChat && hasStoryboard ? "min-w-0 flex-1" : "w-full"}>
          <AnimatePresence mode="wait">
            {tab === "details" && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <DetailsTab brief={brief} />
              </motion.div>
            )}
            {tab === "storyboard" && (
              <motion.div
                key="storyboard"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <StoryboardTab
                  storyboard={storyboard}
                  briefType={brief.brief_type}
                  onGenerate={handleGenerate}
                  onRegenerate={handleRegenerate}
                  generating={generating}
                />
              </motion.div>
            )}
            {tab === "shotlist" && (
              <motion.div
                key="shotlist"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                <ShotlistTab storyboard={storyboard} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showChat && hasStoryboard && (
          <ChatPanel
            chatHistory={storyboard!.chatHistory}
            chatInput={chatInput}
            onInputChange={setChatInput}
            onSend={handleRevise}
            revising={revising}
            chatEndRef={chatEndRef}
          />
        )}
      </div>
    </div>
  );
}

function DetailsTab({ brief }: { brief: BriefData }) {
  const fields: { label: string; value: string | null }[] = [
    { label: "Business", value: brief.business_name },
    { label: "Contact", value: `${brief.contact_name} (${brief.contact_email})` },
    { label: "Type", value: brief.brief_type === "lean" ? "Lean" : "Structured" },
    { label: "Source", value: brief.source },
    { label: "Status", value: brief.status },
    { label: "Delivery date", value: formatDate(brief.delivery_date_ms) },
    { label: "Created", value: formatDate(brief.created_at_ms) },
  ];

  if (brief.project_title)
    fields.push({ label: "Project title", value: brief.project_title });
  if (brief.brief_kind)
    fields.push({ label: "Brief kind", value: brief.brief_kind.replace(/_/g, " ") });
  if (brief.budget_range)
    fields.push({ label: "Budget range", value: brief.budget_range.replace(/_/g, " ") });

  const longFields: { label: string; value: string | null }[] = [
    { label: "Description", value: brief.description },
    { label: "Style references", value: brief.style_references },
    { label: "Key messages", value: brief.key_messages },
    { label: "Target audience", value: brief.target_audience },
    { label: "Deliverables breakdown", value: brief.deliverables_breakdown },
    { label: "Location details", value: brief.location_details },
    { label: "Talent notes", value: brief.talent_notes },
    { label: "Additional notes", value: brief.additional_notes },
  ].filter((f) => f.value);

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          {fields.map((f) => (
            <div key={f.label}>
              <div
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {f.label}
              </div>
              <div className="mt-1 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {longFields.map((f) => (
        <div
          key={f.label}
          className="rounded-xl border p-5"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            borderColor: "rgba(253, 245, 230, 0.06)",
          }}
        >
          <div
            className="mb-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {f.label}
          </div>
          <div className="whitespace-pre-wrap font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
            {f.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryboardTab({
  storyboard,
  briefType,
  onGenerate,
  onRegenerate,
  generating,
}: {
  storyboard: StoryboardData | null;
  briefType: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  generating: boolean;
}) {
  if (!storyboard) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border px-8 py-16"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <Camera
          className="mb-3 size-8 text-[color:var(--color-neutral-600)]"
          strokeWidth={1}
        />
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]">
          No storyboard yet.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          {briefType === "lean"
            ? "add more detail for better results."
            : "something went sideways. try generating."}
        </p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="mt-5 flex items-center gap-2 rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            opacity: generating ? 0.5 : 1,
          }}
        >
          {generating ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Wand2 className="size-4" strokeWidth={1.5} />
          )}
          {generating ? "Generating…" : "Generate storyboard"}
        </button>
      </div>
    );
  }

  if (storyboard.status === "generating") {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border px-8 py-16"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <Loader2
          className="mb-3 size-8 animate-spin text-[color:var(--color-brand-pink)]"
          strokeWidth={1.5}
        />
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]">
          Generating storyboard…
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          opus is thinking. this takes a moment.
        </p>
      </div>
    );
  }

  if (storyboard.status === "failed") {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border px-8 py-16"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <AlertCircle
          className="mb-3 size-8 text-[color:var(--color-brand-red)]"
          strokeWidth={1.5}
        />
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]">
          Generation failed.
        </p>
        {storyboard.errorMessage && (
          <p className="mt-2 max-w-md text-center font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            {storyboard.errorMessage}
          </p>
        )}
        <button
          onClick={onRegenerate}
          disabled={generating}
          className="mt-5 flex items-center gap-2 rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            opacity: generating ? 0.5 : 1,
          }}
        >
          <RefreshCw className="size-4" strokeWidth={1.5} />
          {generating ? "Regenerating…" : "Retry"}
        </button>
      </div>
    );
  }

  const scenes = storyboard.scenes;
  const totalDuration = scenes.reduce((s, sc) => s + (sc.duration_seconds ?? 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
          {scenes.length} scenes &middot; ~{totalDuration}s total
        </div>
        <button
          onClick={onRegenerate}
          disabled={generating}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-brand-cream)]"
          style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
        >
          <RefreshCw className="size-3.5" strokeWidth={1.5} />
          Regenerate
        </button>
      </div>

      <div className="space-y-3">
        {scenes.map((scene, i) => (
          <motion.div
            key={scene.number}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.2 }}
            className="rounded-xl border p-4"
            style={{
              backgroundColor: "var(--color-neutral-900)",
              borderColor: "rgba(253, 245, 230, 0.06)",
            }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span
                className="flex size-7 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-[11px] font-medium"
                style={{
                  background: "rgba(244, 160, 176, 0.12)",
                  color: "var(--color-brand-pink)",
                }}
              >
                {scene.number}
              </span>
              <div className="flex gap-2">
                <span
                  className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{
                    letterSpacing: "1px",
                    background: "rgba(253, 245, 230, 0.05)",
                    color: "var(--color-neutral-400)",
                  }}
                >
                  {SHOT_TYPE_LABELS[scene.shot_type] ?? scene.shot_type}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{
                    letterSpacing: "1px",
                    background: "rgba(253, 245, 230, 0.05)",
                    color: "var(--color-neutral-400)",
                  }}
                >
                  {CAMERA_LABELS[scene.camera_movement] ?? scene.camera_movement}
                </span>
                <span className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
                  {scene.duration_seconds}s
                </span>
              </div>
            </div>

            <p className="font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-brand-cream)]">
              {scene.description}
            </p>

            {scene.audio_notes && (
              <p className="mt-2 font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]">
                Audio: {scene.audio_notes}
              </p>
            )}
            {scene.mood_note && (
              <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
                {scene.mood_note}
              </p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ShotlistTab({
  storyboard,
}: {
  storyboard: StoryboardData | null;
}) {
  if (!storyboard || storyboard.status !== "ready" || !storyboard.shotlist.length) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border px-8 py-16"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <ClipboardList
          className="mb-3 size-8 text-[color:var(--color-neutral-600)]"
          strokeWidth={1}
        />
        <p className="font-[family-name:var(--font-display)] text-[20px] leading-none text-[color:var(--color-brand-cream)]">
          No shotlist yet.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          generate a storyboard first.
        </p>
      </div>
    );
  }

  const groups = storyboard.shotlist;
  const totalMinutes = groups.reduce((s, g) => s + (g.estimated_minutes ?? 0), 0);

  return (
    <div>
      <div className="mb-4 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
        {groups.length} setup{groups.length !== 1 ? "s" : ""} &middot; ~{totalMinutes} min total
      </div>

      <div className="space-y-4">
        {groups.map((group, i) => (
          <motion.div
            key={group.group_number}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="rounded-xl border p-5"
            style={{
              backgroundColor: "var(--color-neutral-900)",
              borderColor: "rgba(253, 245, 230, 0.06)",
            }}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-6 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-[10px] font-medium"
                    style={{
                      background: "rgba(244, 160, 176, 0.12)",
                      color: "var(--color-brand-pink)",
                    }}
                  >
                    {group.group_number}
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                    {group.location}
                  </span>
                </div>
                <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                  {group.setup_description}
                </p>
              </div>
              <span className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
                ~{group.estimated_minutes} min
              </span>
            </div>

            {group.equipment_notes && (
              <p className="mb-3 font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]">
                Equipment: {group.equipment_notes}
              </p>
            )}

            <div className="space-y-1.5">
              {group.scenes.map((s) => (
                <div
                  key={s.scene_number}
                  className="flex items-center gap-3 rounded-md px-3 py-2"
                  style={{ background: "rgba(253, 245, 230, 0.02)" }}
                >
                  <span className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-brand-pink)]">
                    S{s.scene_number}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                    style={{
                      letterSpacing: "0.8px",
                      background: "rgba(253, 245, 230, 0.05)",
                      color: "var(--color-neutral-500)",
                    }}
                  >
                    {SHOT_TYPE_LABELS[s.shot_type] ?? s.shot_type}
                  </span>
                  <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)]">
                    {s.description}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({
  chatHistory,
  chatInput,
  onInputChange,
  onSend,
  revising,
  chatEndRef,
}: {
  chatHistory: StoryboardChatMessage[];
  chatInput: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  revising: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="flex w-[320px] shrink-0 flex-col rounded-xl border"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
        height: "calc(100vh - 240px)",
        position: "sticky",
        top: "120px",
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: "rgba(253, 245, 230, 0.06)" }}
      >
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Revision chat
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {chatHistory.length === 0 && (
          <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-600)]">
            tell the storyboard what to change.
          </p>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-right" : ""}`}
          >
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] ${
                msg.role === "user"
                  ? "text-[color:var(--color-brand-cream)]"
                  : "text-[color:var(--color-neutral-300)]"
              }`}
              style={{
                background:
                  msg.role === "user"
                    ? "rgba(244, 160, 176, 0.12)"
                    : "rgba(253, 245, 230, 0.04)",
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {revising && (
          <div className="mb-3">
            <div
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
              style={{ background: "rgba(253, 245, 230, 0.04)" }}
            >
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
              Revising…
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div
        className="border-t px-3 py-3"
        style={{ borderColor: "rgba(253, 245, 230, 0.06)" }}
      >
        <div className="flex gap-2">
          <input
            value={chatInput}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="e.g. make scene 3 more dramatic…"
            disabled={revising}
            className="flex-1 rounded-md border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-cream)] outline-none transition-colors focus:border-[color:var(--color-brand-pink)]"
            style={{
              borderColor: "rgba(253, 245, 230, 0.1)",
            }}
          />
          <button
            onClick={onSend}
            disabled={!chatInput.trim() || revising}
            className="flex size-9 items-center justify-center rounded-md transition-opacity"
            style={{
              backgroundColor: "var(--color-brand-red)",
              color: "var(--color-brand-cream)",
              opacity: !chatInput.trim() || revising ? 0.4 : 1,
            }}
          >
            <Send className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
