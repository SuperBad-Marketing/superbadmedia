"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck, Pencil, Calendar, Loader2, Heart, X, Camera, Monitor, Sparkles, Clock, ChevronDown, ChevronUp, Send, RotateCcw, ArrowRight, Trash2, RefreshCw, Eye, EyeOff } from "lucide-react";
import type { ContentPlanSlot } from "@/lib/db/schema/instagram";
import type { EnhancedContentPlanSlot } from "@/lib/db/schema/instagram-competitive";
import {
  retryInstagramDiscoveryAction,
  approvePlanSlotsAction,
  updatePlanSlotAction,
} from "../actions";
import { SyncProgressOverlay } from "./sync-progress-overlay";
import { CommentsPanel } from "./comments-panel";
import { InboxPanel } from "./inbox-panel";
import {
  generateStrategyAction,
  reactToInspirationAction,
  fetchInspirationFeedAction,
  updateSlotStatusAction,
  deletePlanAction,
  rescrapeInspirationAction,
} from "../strategy-actions";

interface AccountSummary {
  id: string;
  username: string;
  account_type: string;
  status: string;
}

interface PlanData {
  id: string;
  accountId: string;
  weekStartDate: string;
  weekEndDate: string;
  themeSummary: string;
  slots: ContentPlanSlot[];
  status: string;
}

interface Props {
  accounts: AccountSummary[];
  metaConnected: boolean;
  plans?: PlanData[];
}

export function InstagramDashboardClient({ accounts, metaConnected, plans = [] }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [syncOverlayOpen, setSyncOverlayOpen] = useState(false);
  const [activeView, setActiveView] = useState<"overview" | "comments" | "inbox">("overview");

  const handleSyncComplete = useCallback(
    (result: { followers: number; postsSynced: number } | null) => {
      setSyncOverlayOpen(false);
      if (result) {
        toast.success(
          `Synced — ${result.followers.toLocaleString()} followers, ${result.postsSynced} posts updated.`,
        );
      }
      router.refresh();
    },
    [router],
  );

  const handleSyncError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    const result = await retryInstagramDiscoveryAction();
    setRetrying(false);
    if (result.ok) {
      router.refresh();
    } else {
      setRetryError(result.error);
    }
  }

  if (accounts.length === 0) {
    if (metaConnected) {
      return (
        <div className="py-20 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          >
            <span className="font-[family-name:var(--font-display)] text-[24px] text-[color:var(--color-neutral-600)]">
              IG
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-brand-cream)]">
            Meta connected — Instagram not found
          </h2>
          <p className="mt-2 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            Your Meta account is connected but no Instagram Business Account was
            detected. Make sure your Instagram is linked to a Facebook Page in
            Meta Business Suite, then retry.
          </p>
          {retryError && (
            <p className="mt-3 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
              {retryError}
            </p>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-6 inline-block rounded-lg px-5 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)] disabled:opacity-50"
            style={{ backgroundColor: "var(--color-brand-red)" }}
          >
            {retrying ? "Checking…" : "Retry Connection"}
          </button>
        </div>
      );
    }

    return (
      <div className="py-20 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-neutral-800)" }}
        >
          <span className="font-[family-name:var(--font-display)] text-[24px] text-[color:var(--color-neutral-600)]">
            IG
          </span>
        </div>
        <h2 className="font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-brand-cream)]">
          No Instagram account connected
        </h2>
        <p className="mt-2 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          Connect your Meta account in Settings → Integrations to start
          publishing and tracking metrics.
        </p>
        <Link
          href="/lite/admin/settings/integrations"
          className="mt-6 inline-block rounded-lg px-5 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]"
          style={{
            backgroundColor: "var(--color-brand-red)",
          }}
        >
          Connect Meta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <SyncProgressOverlay
        open={syncOverlayOpen}
        onComplete={handleSyncComplete}
        onError={handleSyncError}
      />
      {/* Account header */}
      <div
        className="flex items-center justify-between rounded-xl border px-5 py-4"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[14px] text-[color:var(--color-brand-cream)]"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          >
            IG
          </div>
          <div>
            <div className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
              @{accounts[0].username}
            </div>
            <div className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
              {accounts[0].account_type === "own"
                ? "SuperBad"
                : "Client account"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSyncOverlayOpen(true)}
            disabled={syncOverlayOpen}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              border: "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            <svg
              className="size-3"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1.5 8a6.5 6.5 0 0 1 11.3-4.4M14.5 8a6.5 6.5 0 0 1-11.3 4.4" />
              <path d="M13.5 1v3.5H10M2.5 15v-3.5H6" />
            </svg>
            Sync
          </button>
          <div className="flex items-center gap-2">
            <span
              className="inline-block size-2 rounded-full"
              style={{ backgroundColor: "var(--color-brand-pink)" }}
            />
            <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
              Connected
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div
        className="flex items-center gap-1"
        style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
      >
        {(
          [
            { key: "overview", label: "Overview" },
            { key: "comments", label: "Comments" },
            { key: "inbox", label: "Inbox" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className="px-3 pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors"
            style={{
              letterSpacing: "1.5px",
              color:
                activeView === tab.key
                  ? "var(--color-brand-cream)"
                  : "var(--color-neutral-500)",
              borderBottom:
                activeView === tab.key
                  ? "2px solid var(--color-brand-red)"
                  : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
        <Link
          href="/lite/content/instagram/replies"
          className="px-3 pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-neutral-400)]"
          style={{
            letterSpacing: "1.5px",
            borderBottom: "2px solid transparent",
          }}
        >
          Reply queue
        </Link>
      </div>

      {/* View content */}
      {activeView === "overview" && (
        <>
          {/* Generate / Regenerate Strategy */}
          <GenerateStrategySection hasExistingPlan={plans.length > 0} />

          {/* Content plans */}
          {plans.map((plan) => {
            const acct = accounts.find((a) => a.id === plan.accountId);
            return (
              <ContentPlanCard
                key={plan.id}
                plan={plan}
                username={acct?.username ?? "unknown"}
              />
            );
          })}

          {/* Inspiration Feed */}
          <InspirationFeed />

          {/* Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DashboardCard title="Followers" subtitle="Growth over time">
              <PlaceholderChart />
            </DashboardCard>
            <DashboardCard title="Engagement" subtitle="Saves, shares, comments">
              <PlaceholderChart />
            </DashboardCard>
            <DashboardCard title="Reach" subtitle="Accounts reached">
              <PlaceholderChart />
            </DashboardCard>
          </div>

          <DashboardCard title="Recent Posts" subtitle="Performance by post">
            <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Metrics sync will populate this once the scheduled task runs.
            </div>
          </DashboardCard>

          <DashboardCard title="Audience" subtitle="Demographics and activity">
            <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Available after 100+ followers.
            </div>
          </DashboardCard>
        </>
      )}

      {activeView === "comments" && <CommentsPanel />}

      {activeView === "inbox" && <InboxPanel />}
    </div>
  );
}

function DashboardCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
          {title}
        </h3>
        <span className="font-[family-name:var(--font-label)] text-[9px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
          {subtitle}
        </span>
      </div>
      {children}
    </div>
  );
}

function PlaceholderChart() {
  return (
    <div
      className="flex h-[120px] items-center justify-center rounded-lg"
      style={{ backgroundColor: "var(--color-neutral-800)" }}
    >
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)]">
        Awaiting data
      </span>
    </div>
  );
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  awaiting_review: {
    bg: "rgba(242, 140, 82, 0.12)",
    color: "var(--color-brand-orange)",
    label: "Awaiting review",
  },
  partially_approved: {
    bg: "rgba(96, 165, 250, 0.12)",
    color: "#60a5fa",
    label: "Partially approved",
  },
  all_approved: {
    bg: "rgba(123, 174, 126, 0.12)",
    color: "var(--color-success)",
    label: "All approved",
  },
  expired: {
    bg: "rgba(128, 127, 115, 0.10)",
    color: "var(--color-neutral-600)",
    label: "Expired",
  },
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  carousel: "var(--color-brand-pink)",
  single: "var(--color-brand-cream)",
  reel: "var(--color-brand-orange)",
  story: "#60a5fa",
};

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      timeZone: "Australia/Melbourne",
    });
  return `${fmt(s)} – ${fmt(e)}`;
}

function ContentPlanCard({
  plan,
  username,
}: {
  plan: PlanData;
  username: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [approving, setApproving] = useState(false);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editTopic, setEditTopic] = useState("");
  const [editCaption, setEditCaption] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const badge = STATUS_BADGE[plan.status] ?? STATUS_BADGE.awaiting_review;
  const unapprovedIndices = plan.slots
    .map((s, i) => (s.approved ? null : i))
    .filter((i): i is number => i !== null);

  function toggleSlot(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(unapprovedIndices));
  }

  async function handleApprove() {
    if (selected.size === 0) return;
    setApproving(true);
    const result = await approvePlanSlotsAction({
      planId: plan.id,
      slotIndices: [...selected],
    });
    setApproving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${result.value.tasksCreated} task${result.value.tasksCreated !== 1 ? "s" : ""} created.`,
    );
    setSelected(new Set());
    router.refresh();
  }

  function startEditing(idx: number) {
    const slot = plan.slots[idx];
    setEditingSlot(idx);
    setEditTopic(slot.topic);
    setEditCaption(slot.caption_direction);
  }

  async function saveEdit() {
    if (editingSlot === null) return;
    await updatePlanSlotAction({
      planId: plan.id,
      slotIndex: editingSlot,
      topic: editTopic,
      captionDirection: editCaption,
    });
    setEditingSlot(null);
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deletePlanAction(plan.id);
    if (result.ok) {
      toast.success("Plan deleted.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar
              className="size-4 text-[color:var(--color-brand-pink)]"
              strokeWidth={1.5}
            />
            <h3 className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)]">
              This week&apos;s plan
            </h3>
            <span className="font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-500)]">
              @{username}
            </span>
          </div>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
            {formatWeekRange(plan.weekStartDate, plan.weekEndDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "1px",
              background: badge.bg,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase tracking-[1px] text-[color:var(--color-brand-cream)] transition-opacity disabled:opacity-50"
                style={{ backgroundColor: "var(--color-brand-red)" }}
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]"
              title="Delete plan"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Theme */}
      <p className="mb-4 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
        {plan.themeSummary}
      </p>

      {/* Slots */}
      <div className="space-y-2">
        {plan.slots.map((slot, idx) => {
          const enhanced = slot as EnhancedContentPlanSlot;
          const slotStatus = enhanced.status ?? (slot.approved ? "approved" : "pending");
          const isManual = enhanced.requires_manual_input ?? false;
          const steps = enhanced.creation_steps ?? [];
          const estimatedMin = enhanced.estimated_minutes ?? 15;

          return (
            <SlotCard
              key={idx}
              slot={slot}
              enhanced={enhanced}
              idx={idx}
              slotStatus={slotStatus}
              isManual={isManual}
              steps={steps}
              estimatedMin={estimatedMin}
              selected={selected.has(idx)}
              onToggle={() => !slot.approved && toggleSlot(idx)}
              editing={editingSlot === idx}
              editTopic={editTopic}
              editCaption={editCaption}
              onEditTopicChange={setEditTopic}
              onEditCaptionChange={setEditCaption}
              onStartEdit={() => startEditing(idx)}
              onSaveEdit={saveEdit}
              onCancelEdit={() => setEditingSlot(null)}
              planId={plan.id}
            />
          );
        })}
      </div>

      {/* Action bar */}
      {unapprovedIndices.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={selected.size === 0 || approving}
            className="flex items-center gap-1.5 rounded-md px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
            style={{
              backgroundColor: "var(--color-brand-red)",
              color: "var(--color-brand-cream)",
              opacity: selected.size === 0 || approving ? 0.4 : 1,
            }}
          >
            {approving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Check className="size-4" strokeWidth={1.5} />
            )}
            {approving
              ? "Approving…"
              : `Approve selected (${selected.size})`}
          </button>
          {selected.size < unapprovedIndices.length && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-brand-cream)]"
            >
              <CheckCheck className="size-3.5" strokeWidth={1.5} />
              Approve all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const SLOT_STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  pending: {
    bg: "rgba(128, 127, 115, 0.10)",
    color: "var(--color-neutral-500)",
    label: "Pending",
  },
  approved: {
    bg: "rgba(96, 165, 250, 0.12)",
    color: "#60a5fa",
    label: "Approved",
  },
  created: {
    bg: "rgba(242, 140, 82, 0.12)",
    color: "var(--color-brand-orange)",
    label: "Created",
  },
  posted: {
    bg: "rgba(123, 174, 126, 0.12)",
    color: "var(--color-success)",
    label: "Posted",
  },
  pushed_back: {
    bg: "rgba(96, 165, 250, 0.08)",
    color: "#60a5fa",
    label: "Pushed back",
  },
  dropped: {
    bg: "rgba(178, 40, 72, 0.10)",
    color: "var(--color-brand-red)",
    label: "Dropped",
  },
};

function SlotCard({
  slot,
  enhanced,
  idx,
  slotStatus,
  isManual,
  steps,
  estimatedMin,
  selected,
  onToggle,
  editing,
  editTopic,
  editCaption,
  onEditTopicChange,
  onEditCaptionChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  planId,
}: {
  slot: ContentPlanSlot;
  enhanced: EnhancedContentPlanSlot;
  idx: number;
  slotStatus: string;
  isManual: boolean;
  steps: Array<{ step: number; instruction: string; is_manual: boolean }>;
  estimatedMin: number;
  selected: boolean;
  onToggle: () => void;
  editing: boolean;
  editTopic: string;
  editCaption: string;
  onEditTopicChange: (v: string) => void;
  onEditCaptionChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  planId: string;
}) {
  const router = useRouter();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const badge = SLOT_STATUS_BADGE[slotStatus] ?? SLOT_STATUS_BADGE.pending;

  const STATUS_TOAST: Record<string, string> = {
    created: "Marked as created.",
    posted: "Marked as posted.",
    pushed_back: "Pushed back.",
    dropped: "Dropped.",
    approved: "Restored.",
    pending: "Reverted to pending.",
  };

  async function handleMarkStatus(status: "pending" | "approved" | "created" | "posted" | "pushed_back" | "dropped") {
    setUpdating(true);
    const result = await updateSlotStatusAction({
      planId,
      slotIndex: idx,
      status,
    });
    if (result.ok) {
      toast.success(STATUS_TOAST[status] ?? "Updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setUpdating(false);
  }

  return (
    <div
      className="rounded-lg px-3 py-2.5 transition-colors"
      style={{
        background: slotStatus === "dropped"
          ? "rgba(178, 40, 72, 0.04)"
          : slotStatus === "pushed_back"
            ? "rgba(96, 165, 250, 0.03)"
            : slotStatus === "posted"
              ? "rgba(123, 174, 126, 0.05)"
              : slotStatus === "created"
                ? "rgba(242, 140, 82, 0.04)"
                : slot.approved
                  ? "rgba(96, 165, 250, 0.04)"
                  : selected
                    ? "rgba(244, 160, 176, 0.08)"
                    : "rgba(253, 245, 230, 0.02)",
        opacity: slotStatus === "dropped" ? 0.5 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={slot.approved || slotStatus === "created" || slotStatus === "posted" || slotStatus === "pushed_back" || slotStatus === "dropped"}
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors"
          style={{
            borderColor: slotStatus === "dropped"
              ? "var(--color-brand-red)"
              : slotStatus === "pushed_back"
                ? "var(--color-neutral-600)"
                : slotStatus === "posted"
                  ? "var(--color-success)"
                  : slotStatus === "created"
                    ? "var(--color-brand-orange)"
                    : slot.approved
                      ? "#60a5fa"
                      : selected
                        ? "var(--color-brand-pink)"
                        : "rgba(253, 245, 230, 0.15)",
            backgroundColor: slotStatus === "dropped"
              ? "rgba(178, 40, 72, 0.15)"
              : slotStatus === "pushed_back"
                ? "rgba(128, 127, 115, 0.1)"
                : slotStatus === "posted"
                  ? "rgba(123, 174, 126, 0.2)"
                  : slotStatus === "created"
                    ? "rgba(242, 140, 82, 0.15)"
                : slot.approved
                  ? "rgba(96, 165, 250, 0.15)"
                  : selected
                    ? "rgba(244, 160, 176, 0.2)"
                    : "transparent",
          }}
        >
          {slotStatus === "dropped" ? (
            <X className="size-3" strokeWidth={2} style={{ color: "var(--color-brand-red)" }} />
          ) : slotStatus === "pushed_back" ? (
            <ArrowRight className="size-3" strokeWidth={2} style={{ color: "var(--color-neutral-600)" }} />
          ) : (slot.approved || selected || slotStatus === "created" || slotStatus === "posted") ? (
            <Check className="size-3" strokeWidth={2} style={{
              color: slotStatus === "posted"
                ? "var(--color-success)"
                : slotStatus === "created"
                  ? "var(--color-brand-orange)"
                  : slot.approved
                    ? "#60a5fa"
                    : "var(--color-brand-pink)",
            }} />
          ) : null}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <input
                value={editTopic}
                onChange={(e) => onEditTopicChange(e.target.value)}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
                style={{ borderColor: "rgba(253, 245, 230, 0.15)" }}
              />
              <textarea
                value={editCaption}
                onChange={(e) => onEditCaptionChange(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-transparent px-2 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)] outline-none focus:border-[color:var(--color-brand-pink)]"
                style={{ borderColor: "rgba(253, 245, 230, 0.15)" }}
              />
              <div className="flex gap-2">
                <button
                  onClick={onSaveEdit}
                  className="rounded-md px-3 py-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-cream)]"
                  style={{ backgroundColor: "var(--color-brand-red)" }}
                >
                  Save
                </button>
                <button
                  onClick={onCancelEdit}
                  className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                  {slot.topic}
                </span>
                {!slot.approved && slotStatus === "pending" && (
                  <button
                    onClick={onStartEdit}
                    className="text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                  >
                    <Pencil className="size-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                {slot.caption_direction}
              </p>

              {/* Manual input notice */}
              {isManual && enhanced.manual_input_description && slotStatus !== "posted" && (
                <div
                  className="mt-1.5 flex items-start gap-1.5 rounded-md px-2 py-1.5"
                  style={{ backgroundColor: "rgba(242, 140, 82, 0.08)" }}
                >
                  <Camera className="mt-0.5 size-3 shrink-0 text-[color:var(--color-brand-orange)]" strokeWidth={1.5} />
                  <span className="font-[family-name:var(--font-body)] text-[11px] leading-[1.4] text-[color:var(--color-brand-orange)]">
                    {enhanced.manual_input_description}
                  </span>
                </div>
              )}

              {/* Creation steps toggle */}
              {steps.length > 0 && (
                <button
                  onClick={() => setStepsOpen(!stepsOpen)}
                  className="mt-1.5 flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                >
                  {stepsOpen ? (
                    <ChevronUp className="size-3" strokeWidth={1.5} />
                  ) : (
                    <ChevronDown className="size-3" strokeWidth={1.5} />
                  )}
                  {steps.length} step{steps.length !== 1 ? "s" : ""}
                </button>
              )}

              {/* Steps list */}
              {stepsOpen && steps.length > 0 && (
                <div className="mt-2 space-y-1.5 border-l-2 pl-3" style={{ borderColor: "rgba(253, 245, 230, 0.08)" }}>
                  {steps.map((step) => (
                    <div key={step.step} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-[8px] tabular-nums"
                        style={{
                          backgroundColor: step.is_manual ? "rgba(242, 140, 82, 0.15)" : "rgba(253, 245, 230, 0.06)",
                          color: step.is_manual ? "var(--color-brand-orange)" : "var(--color-neutral-500)",
                        }}
                      >
                        {step.step}
                      </span>
                      <span className="font-[family-name:var(--font-body)] text-[11px] leading-[1.4] text-[color:var(--color-neutral-400)]">
                        {step.instruction}
                        {step.is_manual && (
                          <span className="ml-1 text-[color:var(--color-brand-orange)]">(manual)</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action links */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {slotStatus === "approved" && (
                  <>
                    <Link
                      href={`/lite/content/studio?prefill_type=${slot.content_type}&prefill_brief=${encodeURIComponent(slot.topic + ". " + slot.caption_direction)}`}
                      className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      Create in Studio →
                    </Link>
                    <button
                      onClick={() => handleMarkStatus("created")}
                      disabled={updating}
                      className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      Mark as created
                    </button>
                    <button
                      onClick={() => handleMarkStatus("pushed_back")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      <ArrowRight className="size-3" strokeWidth={1.5} />
                      Push back
                    </button>
                    <button
                      onClick={() => handleMarkStatus("dropped")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]"
                    >
                      <Trash2 className="size-3" strokeWidth={1.5} />
                      Drop
                    </button>
                  </>
                )}
                {slotStatus === "created" && (
                  <>
                    <button
                      onClick={() => handleMarkStatus("posted")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      <Send className="size-3" strokeWidth={1.5} />
                      Mark as posted
                    </button>
                    <button
                      onClick={() => handleMarkStatus("pushed_back")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      <ArrowRight className="size-3" strokeWidth={1.5} />
                      Push back
                    </button>
                    <button
                      onClick={() => handleMarkStatus("dropped")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]"
                    >
                      <Trash2 className="size-3" strokeWidth={1.5} />
                      Drop
                    </button>
                  </>
                )}
                {slotStatus === "pushed_back" && (
                  <>
                    <button
                      onClick={() => handleMarkStatus("approved")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      <RotateCcw className="size-3" strokeWidth={1.5} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleMarkStatus("dropped")}
                      disabled={updating}
                      className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]"
                    >
                      <Trash2 className="size-3" strokeWidth={1.5} />
                      Drop
                    </button>
                  </>
                )}
                {slotStatus === "dropped" && (
                  <button
                    onClick={() => handleMarkStatus("approved")}
                    disabled={updating}
                    className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                  >
                    <RotateCcw className="size-3" strokeWidth={1.5} />
                    Restore
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Meta column */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "0.8px",
              background: "rgba(253, 245, 230, 0.05)",
              color: CONTENT_TYPE_COLORS[slot.content_type] ?? "var(--color-neutral-400)",
            }}
          >
            {slot.content_type}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{ letterSpacing: "0.8px", background: badge.bg, color: badge.color }}
          >
            {badge.label}
          </span>
          <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
            {slot.day_of_week}
          </span>
          <span className="flex items-center gap-0.5 font-[family-name:var(--font-body)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
            <Clock className="size-2.5" strokeWidth={1.5} />
            {estimatedMin}m
          </span>
        </div>
      </div>
    </div>
  );
}

const STRATEGY_PHASES = [
  { key: "gather", label: "Gathering brand voice", durationMs: 2200 },
  { key: "competitors", label: "Analysing competitors", durationMs: 2800 },
  { key: "ideas", label: "Mining braindump ideas", durationMs: 1800 },
  { key: "strategy", label: "Generating strategy", durationMs: 8000 },
  { key: "plan", label: "Building content plan", durationMs: 2500 },
  { key: "finalise", label: "Creating tasks", durationMs: 1700 },
] as const;

const TOTAL_ESTIMATED_MS = STRATEGY_PHASES.reduce((s, p) => s + p.durationMs, 0);

function GenerateStrategySection({ hasExistingPlan = false }: { hasExistingPlan?: boolean }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const startRef = useRef(0);
  const frameRef = useRef<number>(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = now - startRef.current;
    setElapsedMs(elapsed);

    let cumulative = 0;
    let phase = 0;
    for (let i = 0; i < STRATEGY_PHASES.length; i++) {
      if (elapsed < cumulative + STRATEGY_PHASES[i].durationMs) {
        phase = i;
        const intoPhase = elapsed - cumulative;
        setPhaseProgress(Math.min(intoPhase / STRATEGY_PHASES[i].durationMs, 0.95));
        break;
      }
      cumulative += STRATEGY_PHASES[i].durationMs;
      if (i === STRATEGY_PHASES.length - 1) {
        phase = i;
        setPhaseProgress(0.95);
      }
    }
    setActivePhase(phase);
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!generating || done) return;
    startRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [generating, done, tick]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setActivePhase(0);
    setPhaseProgress(0);
    setElapsedMs(0);
    setDone(false);
    try {
      const result = await generateStrategyAction();
      setDone(true);
      cancelAnimationFrame(frameRef.current);
      if (result.ok) {
        setActivePhase(STRATEGY_PHASES.length - 1);
        setPhaseProgress(1);
        await new Promise((r) => setTimeout(r, 800));
        toast.success("Strategy generated — your next 5 posts are ready.");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    } catch {
      setDone(true);
      cancelAnimationFrame(frameRef.current);
      setError("Strategy generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  const globalProgress = Math.min(elapsedMs / TOTAL_ESTIMATED_MS, done ? 1 : 0.97);
  const remainingSeconds = done
    ? 0
    : Math.max(1, Math.ceil((TOTAL_ESTIMATED_MS - elapsedMs) / 1000));

  return (
    <div
      className="rounded-xl border p-8"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <AnimatePresence mode="wait">
        {!generating && !done ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={hasExistingPlan ? "" : "text-center"}
          >
            {hasExistingPlan ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(244, 160, 176, 0.1)" }}
                  >
                    <RefreshCw
                      className="size-4 text-[color:var(--color-brand-pink)]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <div>
                    <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                      Regenerate strategy
                    </span>
                    <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                      Creates a fresh content plan using your latest Brand DNA,
                      competitor intel, and braindump ideas.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] transition-opacity hover:opacity-90"
                  style={{
                    letterSpacing: "1.5px",
                    backgroundColor: "var(--color-brand-red)",
                  }}
                >
                  <RefreshCw className="size-3.5" strokeWidth={1.5} />
                  Regenerate
                </button>
              </div>
            ) : (
              <>
                <div
                  className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(244, 160, 176, 0.1)" }}
                >
                  <Sparkles
                    className="size-6 text-[color:var(--color-brand-pink)]"
                    strokeWidth={1.5}
                  />
                </div>
                <h3 className="font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-brand-cream)] text-balance">
                  Generate your first strategy
                </h3>
                <p className="mx-auto mt-2 max-w-[480px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)] text-pretty">
                  No existing posts needed. The platform uses your Brand DNA,
                  competitive intelligence from watched accounts, and your
                  braindump ideas to create a step-by-step content plan.
                </p>
                <button
                  onClick={handleGenerate}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-opacity hover:opacity-90"
                  style={{
                    letterSpacing: "1.5px",
                    backgroundColor: "var(--color-brand-red)",
                  }}
                >
                  <Sparkles className="size-4" strokeWidth={1.5} />
                  Generate Strategy
                </button>
              </>
            )}
            {error && (
              <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
                {error}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="generating"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(244, 160, 176, 0.1)" }}
                >
                  <Sparkles
                    className="size-4 text-[color:var(--color-brand-pink)]"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-[16px] leading-none text-[color:var(--color-brand-cream)]">
                    {done ? "Strategy ready" : "Building strategy"}
                  </h3>
                  <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] tabular-nums text-[color:var(--color-neutral-500)]">
                    {done ? (
                      "Your content plan is ready to review."
                    ) : (
                      <>
                        <Clock className="mr-1 inline size-3" strokeWidth={1.5} />
                        ~{remainingSeconds}s remaining
                      </>
                    )}
                  </p>
                </div>
              </div>
              <span className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "0.5px" }}>
                {Math.round(globalProgress * 100)}%
              </span>
            </div>

            {/* Global progress bar */}
            <div
              className="mb-6 h-[3px] w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "var(--color-brand-pink)" }}
                initial={{ width: "0%" }}
                animate={{ width: `${globalProgress * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            {/* Phase list */}
            <div className="space-y-0">
              {STRATEGY_PHASES.map((phase, i) => {
                const isActive = generating && activePhase === i && !done;
                const isComplete = done || activePhase > i;

                return (
                  <div
                    key={phase.key}
                    className="flex items-center gap-3 py-2"
                    style={{
                      borderTop:
                        i > 0
                          ? "1px solid rgba(253, 245, 230, 0.04)"
                          : undefined,
                    }}
                  >
                    {/* Status indicator */}
                    <div className="flex size-6 shrink-0 items-center justify-center">
                      <AnimatePresence mode="wait">
                        {isComplete ? (
                          <motion.div
                            key="done"
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{
                              type: "spring",
                              mass: 1,
                              stiffness: 220,
                              damping: 25,
                            }}
                            className="flex size-5 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: "rgba(123, 174, 126, 0.15)",
                            }}
                          >
                            <Check
                              className="size-3 text-[#7BAE7E]"
                              strokeWidth={2}
                            />
                          </motion.div>
                        ) : isActive ? (
                          <motion.div
                            key="active"
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative flex size-5 items-center justify-center"
                          >
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{
                                backgroundColor: "var(--color-brand-pink)",
                              }}
                              animate={{ opacity: [0.15, 0.3, 0.15] }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <div
                              className="size-2 rounded-full"
                              style={{
                                backgroundColor: "var(--color-brand-pink)",
                              }}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="pending"
                            className="size-1.5 rounded-full"
                            style={{
                              backgroundColor: "var(--color-neutral-700)",
                            }}
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Label */}
                    <span
                      className="font-[family-name:var(--font-body)] text-[13px] transition-colors duration-300"
                      style={{
                        color: isActive
                          ? "var(--color-brand-cream)"
                          : isComplete
                            ? "var(--color-neutral-500)"
                            : "var(--color-neutral-600)",
                      }}
                    >
                      {phase.label}
                    </span>

                    {/* Per-phase micro bar (active only) */}
                    {isActive && (
                      <div className="ml-auto flex items-center gap-2">
                        <div
                          className="h-[2px] w-16 overflow-hidden rounded-full"
                          style={{
                            backgroundColor: "rgba(253, 245, 230, 0.06)",
                          }}
                        >
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              backgroundColor: "var(--color-brand-pink)",
                              opacity: 0.6,
                            }}
                            animate={{
                              width: `${phaseProgress * 100}%`,
                            }}
                            transition={{
                              duration: 0.4,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InspirationPost {
  id: string;
  imageUrl: string;
  caption: string | null;
  mediaType: string;
  likes: number;
  comments: number;
  finalScore: number;
  whyHigh: string | null;
  permalink: string | null;
  accountUsername: string;
  accountFollowers: number;
  reaction: "like" | "dislike" | null;
}

function InspirationFeed() {
  const [posts, setPosts] = useState<InspirationPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [filter, setFilter] = useState<"all" | "liked" | "undecided" | "dismissed">("all");
  const [selectedPost, setSelectedPost] = useState<InspirationPost | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const [rescraping, setRescraping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await fetchInspirationFeedAction();
      if (!cancelled && result.ok) {
        setPosts(result.value);
      }
      if (!cancelled) setLoaded(true);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleRescrape() {
    setRescraping(true);
    const result = await rescrapeInspirationAction();
    if (result.ok) {
      toast.success(`Scraped ${result.value.postsStored} new posts.`);
      const fresh = await fetchInspirationFeedAction();
      if (fresh.ok) setPosts(fresh.value);
    } else {
      toast.error(result.error);
    }
    setRescraping(false);
  }

  async function handleReact(postId: string, reaction: "like" | "dislike") {
    setReacting(postId);
    const result = await reactToInspirationAction({
      competitorPostId: postId,
      reaction,
    });
    if (result.ok) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, reaction } : p,
        ),
      );
    }
    setReacting(null);
  }

  if (!loaded || posts.length === 0) return null;

  const filtered = posts.filter((p) => {
    if (filter === "liked") return p.reaction === "like";
    if (filter === "dismissed") return p.reaction === "dislike";
    if (filter === "undecided") return p.reaction === null;
    return true;
  });

  const FILTER_OPTIONS = [
    { key: "all" as const, label: "All" },
    { key: "liked" as const, label: "Liked" },
    { key: "undecided" as const, label: "Undecided" },
    { key: "dismissed" as const, label: "Dismissed" },
  ];

  const likedCount = posts.filter((p) => p.reaction === "like").length;
  const undecidedCount = posts.filter((p) => p.reaction === null).length;

  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      {/* Collapsible header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2"
        >
          <h3 className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
            Inspiration
          </h3>
          <span className="font-[family-name:var(--font-label)] text-[9px] tabular-nums text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "0.5px" }}>
            {posts.length} posts
            {likedCount > 0 && ` · ${likedCount} liked`}
            {undecidedCount > 0 && ` · ${undecidedCount} undecided`}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRescrape}
            disabled={rescraping}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              border: "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            {rescraping ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="size-3" strokeWidth={1.5} />
            )}
            {rescraping ? "Scraping…" : "Re-scrape"}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronDown className="size-4 text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
            ) : (
              <ChevronUp className="size-4 text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-5 pb-5">
          {/* Filter tabs */}
          <div className="mb-4 flex gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className="rounded-md px-2 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase transition-colors"
                style={{
                  letterSpacing: "1px",
                  backgroundColor:
                    filter === opt.key
                      ? "rgba(244, 160, 176, 0.15)"
                      : "transparent",
                  color:
                    filter === opt.key
                      ? "var(--color-brand-pink)"
                      : "var(--color-neutral-500)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <InspirationCard
                key={post.id}
                post={post}
                onOpen={() => setSelectedPost(post)}
                onReact={(r) => handleReact(post.id, r)}
                reacting={reacting === post.id}
              />
            ))}
          </div>

          <AnimatePresence>
            {selectedPost && (
              <InspirationModal
                post={selectedPost}
                onClose={() => setSelectedPost(null)}
                onReact={(r) => handleReact(selectedPost.id, r)}
                reacting={reacting === selectedPost.id}
              />
            )}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              {filter === "all"
                ? "Add watched accounts in Settings to see inspiration posts."
                : `No ${filter} posts.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function embedUrlFromPermalink(permalink: string): string | null {
  try {
    const url = new URL(permalink);
    const path = url.pathname.replace(/\/+$/, "");
    return `https://www.instagram.com${path}/embed/`;
  } catch {
    return null;
  }
}

const houseSpring = { type: "spring" as const, stiffness: 220, damping: 25, mass: 1 };

function InspirationCard({
  post,
  onOpen,
  onReact,
  reacting,
}: {
  post: InspirationPost;
  onOpen: () => void;
  onReact: (reaction: "like" | "dislike") => void;
  reacting: boolean;
}) {
  const isLiked = post.reaction === "like";
  const isDisliked = post.reaction === "dislike";
  const embedUrl = post.permalink ? embedUrlFromPermalink(post.permalink) : null;

  return (
    <div
      className="overflow-hidden rounded-lg border transition-opacity"
      style={{
        borderColor: isLiked
          ? "rgba(244, 160, 176, 0.3)"
          : "rgba(253, 245, 230, 0.06)",
        opacity: isDisliked ? 0.35 : 1,
      }}
    >
      {/* Clickable embed area — iframe is visual-only, clicks open modal */}
      <button
        onClick={onOpen}
        className="relative block w-full cursor-pointer"
      >
        {embedUrl ? (
          <div className="relative w-full overflow-hidden" style={{ height: "320px" }}>
            <iframe
              src={embedUrl}
              className="w-full border-0 pointer-events-none"
              style={{ height: "480px", background: "var(--color-neutral-800)" }}
              loading="lazy"
              tabIndex={-1}
              allowTransparency
            />
          </div>
        ) : (
          <div
            className="flex aspect-[4/3] w-full items-center justify-center"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          >
            <div className="text-center">
              <EyeOff className="mx-auto mb-1 size-5 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
              <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                No permalink
              </span>
            </div>
          </div>
        )}
        {/* Hover hint */}
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:opacity-100"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        >
          <Eye className="size-6 text-[color:var(--color-brand-cream)]" strokeWidth={1.5} />
        </div>
      </button>

      {/* Meta bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: "var(--color-neutral-900)" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
            @{post.accountUsername}
          </span>
          <span
            className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[9px] font-semibold tabular-nums"
            style={{
              backgroundColor: "rgba(244, 160, 176, 0.25)",
              color: "var(--color-brand-pink)",
              letterSpacing: "0.5px",
            }}
          >
            {post.finalScore.toFixed(1)}× avg
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onReact("like")}
            disabled={reacting}
            className="flex size-7 items-center justify-center rounded-full transition-colors"
            aria-label="Like this post"
            style={{
              backgroundColor: isLiked
                ? "rgba(244, 160, 176, 0.2)"
                : "rgba(253, 245, 230, 0.05)",
            }}
          >
            <Heart
              className="size-3.5"
              strokeWidth={1.5}
              fill={isLiked ? "var(--color-brand-pink)" : "none"}
              style={{
                color: isLiked
                  ? "var(--color-brand-pink)"
                  : "var(--color-neutral-500)",
              }}
            />
          </button>
          <button
            onClick={() => onReact("dislike")}
            disabled={reacting}
            className="flex size-7 items-center justify-center rounded-full transition-colors"
            aria-label="Dismiss this post"
            style={{
              backgroundColor: isDisliked
                ? "rgba(255, 100, 100, 0.15)"
                : "rgba(253, 245, 230, 0.05)",
            }}
          >
            <X
              className="size-3.5"
              strokeWidth={1.5}
              style={{
                color: isDisliked
                  ? "var(--color-brand-red)"
                  : "var(--color-neutral-500)",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function InspirationModal({
  post,
  onClose,
  onReact,
  reacting,
}: {
  post: InspirationPost;
  onClose: () => void;
  onReact: (reaction: "like" | "dislike") => void;
  reacting: boolean;
}) {
  const isLiked = post.reaction === "like";
  const isDisliked = post.reaction === "dislike";
  const embedUrl = post.permalink ? embedUrlFromPermalink(post.permalink) : null;
  const er = ((post.likes + post.comments) / Math.max(post.accountFollowers, 1) * 100).toFixed(2);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Panel */}
      <motion.div
        className="relative flex max-h-[90vh] w-full max-w-[900px] overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.08)",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={houseSpring}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full transition-colors"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <X className="size-4 text-[color:var(--color-brand-cream)]" strokeWidth={1.5} />
        </button>

        {/* Left: Instagram embed */}
        <div
          className="hidden w-[55%] shrink-0 sm:block"
          style={{ backgroundColor: "var(--color-neutral-950)" }}
        >
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="h-full w-full border-0"
              style={{ minHeight: "500px" }}
              allowTransparency
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EyeOff className="size-8 text-[color:var(--color-neutral-700)]" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Right: Metadata panel */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Mobile-only embed */}
          <div className="sm:hidden">
            {embedUrl && (
              <iframe
                src={embedUrl}
                className="w-full border-0"
                style={{ height: "400px" }}
                allowTransparency
              />
            )}
          </div>

          <div className="flex flex-1 flex-col p-5">
            {/* Account header */}
            <motion.div
              className="mb-4 flex items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.05 }}
            >
              <div
                className="flex size-10 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[12px] text-[color:var(--color-brand-cream)]"
                style={{ backgroundColor: "var(--color-neutral-800)" }}
              >
                IG
              </div>
              <div>
                <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                  @{post.accountUsername}
                </span>
                <div className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
                  {post.accountFollowers.toLocaleString()} followers
                </div>
              </div>
            </motion.div>

            {/* Score + stats */}
            <motion.div
              className="mb-4 flex flex-wrap items-center gap-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.1 }}
            >
              <span
                className="rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[11px] font-semibold tabular-nums"
                style={{
                  backgroundColor: "rgba(244, 160, 176, 0.15)",
                  color: "var(--color-brand-pink)",
                  letterSpacing: "0.5px",
                }}
              >
                {post.finalScore.toFixed(1)}× avg
              </span>
              <span
                className="rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
                style={{
                  letterSpacing: "0.8px",
                  background: "rgba(253, 245, 230, 0.05)",
                  color: CONTENT_TYPE_COLORS[post.mediaType.toLowerCase()] ?? "var(--color-neutral-400)",
                }}
              >
                {post.mediaType === "CAROUSEL_ALBUM" ? "carousel" : post.mediaType.toLowerCase()}
              </span>
            </motion.div>

            <motion.div
              className="mb-4 flex gap-4 font-[family-name:var(--font-body)] text-[12px] tabular-nums text-[color:var(--color-neutral-400)]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.15 }}
            >
              <span>{post.likes.toLocaleString()} likes</span>
              <span>{post.comments.toLocaleString()} comments</span>
              <span>ER: {er}%</span>
            </motion.div>

            {/* Why it performed */}
            {post.whyHigh && (
              <motion.p
                className="mb-4 rounded-lg p-3 font-[family-name:var(--font-narrative)] text-[13px] italic leading-[1.5] text-[color:var(--color-brand-pink)]"
                style={{ backgroundColor: "rgba(244, 160, 176, 0.06)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: 0.2 }}
              >
                {post.whyHigh}
              </motion.p>
            )}

            {/* Caption */}
            {post.caption && (
              <motion.p
                className="mb-4 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]"
                style={{ maxHeight: "200px", overflowY: "auto" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: 0.25 }}
              >
                {post.caption}
              </motion.p>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Actions bar */}
            <motion.div
              className="flex items-center justify-between border-t pt-4"
              style={{ borderColor: "rgba(253, 245, 230, 0.06)" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...houseSpring, delay: 0.3 }}
            >
              <div className="flex gap-2">
                <button
                  onClick={() => onReact("like")}
                  disabled={reacting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] transition-colors"
                  style={{
                    backgroundColor: isLiked ? "rgba(244, 160, 176, 0.15)" : "rgba(253, 245, 230, 0.05)",
                    color: isLiked ? "var(--color-brand-pink)" : "var(--color-neutral-400)",
                  }}
                >
                  <Heart
                    className="size-4"
                    strokeWidth={1.5}
                    fill={isLiked ? "var(--color-brand-pink)" : "none"}
                  />
                  {isLiked ? "Liked" : "Like"}
                </button>
                <button
                  onClick={() => onReact("dislike")}
                  disabled={reacting}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] transition-colors"
                  style={{
                    backgroundColor: isDisliked ? "rgba(255, 100, 100, 0.1)" : "rgba(253, 245, 230, 0.05)",
                    color: isDisliked ? "var(--color-brand-red)" : "var(--color-neutral-400)",
                  }}
                >
                  <X className="size-4" strokeWidth={1.5} />
                  {isDisliked ? "Dismissed" : "Dismiss"}
                </button>
              </div>

              {post.permalink && (
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                >
                  View on Instagram
                  <ArrowRight className="size-3" strokeWidth={1.5} />
                </a>
              )}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
