"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, CheckCheck, Pencil, Calendar, Loader2, Heart, X, Camera, Monitor, Sparkles } from "lucide-react";
import type { ContentPlanSlot } from "@/lib/db/schema/instagram";
import type { EnhancedContentPlanSlot } from "@/lib/db/schema/instagram-competitive";
import {
  retryInstagramDiscoveryAction,
  approvePlanSlotsAction,
  updatePlanSlotAction,
  syncInstagramDataAction,
} from "../actions";
import {
  generateStrategyAction,
  reactToInspirationAction,
  fetchInspirationFeedAction,
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
  const [syncing, setSyncing] = useState(false);

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

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncInstagramDataAction();
      if (result.ok) {
        toast.success(
          `Synced — ${result.value.followers.toLocaleString()} followers, ${result.value.postsSynced} posts updated.`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Sync failed. Try again.");
    } finally {
      setSyncing(false);
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
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-neutral-800)",
              color: "var(--color-brand-cream)",
              border: "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            {syncing ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            ) : (
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
            )}
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--color-brand-pink)" }}
            />
            <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
              Connected
            </span>
          </div>
        </div>
      </div>

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

      {/* Generate Strategy button — shows when no plans exist */}
      {plans.length === 0 && <GenerateStrategySection />}

      {/* Inspiration Feed */}
      <InspirationFeed />

      {/* Placeholder sections — will be populated in subsequent sessions */}
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
      </div>

      {/* Theme */}
      <p className="mb-4 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
        {plan.themeSummary}
      </p>

      {/* Slots */}
      <div className="space-y-2">
        {plan.slots.map((slot, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
            style={{
              background: slot.approved
                ? "rgba(123, 174, 126, 0.05)"
                : selected.has(idx)
                  ? "rgba(244, 160, 176, 0.08)"
                  : "rgba(253, 245, 230, 0.02)",
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => !slot.approved && toggleSlot(idx)}
              disabled={slot.approved}
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors"
              style={{
                borderColor: slot.approved
                  ? "var(--color-success)"
                  : selected.has(idx)
                    ? "var(--color-brand-pink)"
                    : "rgba(253, 245, 230, 0.15)",
                backgroundColor: slot.approved
                  ? "rgba(123, 174, 126, 0.2)"
                  : selected.has(idx)
                    ? "rgba(244, 160, 176, 0.2)"
                    : "transparent",
              }}
            >
              {(slot.approved || selected.has(idx)) && (
                <Check className="size-3" strokeWidth={2} style={{
                  color: slot.approved ? "var(--color-success)" : "var(--color-brand-pink)",
                }} />
              )}
            </button>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {editingSlot === idx ? (
                <div className="space-y-2">
                  <input
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
                    style={{ borderColor: "rgba(253, 245, 230, 0.15)" }}
                  />
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border bg-transparent px-2 py-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)] outline-none focus:border-[color:var(--color-brand-pink)]"
                    style={{ borderColor: "rgba(253, 245, 230, 0.15)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      className="rounded-md px-3 py-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-cream)]"
                      style={{ backgroundColor: "var(--color-brand-red)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSlot(null)}
                      className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]"
                    >
                      {slot.topic}
                    </span>
                    {!slot.approved && (
                      <button
                        onClick={() => startEditing(idx)}
                        className="text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                      >
                        <Pencil className="size-3" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                    {slot.caption_direction}
                  </p>
                  {slot.approved && slot.task_id && (
                    <Link
                      href={`/lite/content/studio?prefill_type=${slot.content_type}&prefill_brief=${encodeURIComponent(slot.topic + ". " + slot.caption_direction)}`}
                      className="mt-1 inline-block font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
                    >
                      Create in Studio →
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Meta */}
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
              <span className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
                {slot.day_of_week}
              </span>
            </div>
          </div>
        ))}
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

function GenerateStrategySection() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateStrategyAction();
      if (result.ok) {
        toast.success("Strategy generated — your next 5 posts are ready.");
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    } catch {
      setError("Strategy generation failed. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-8 text-center"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
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
        No existing posts needed. The platform uses your Brand DNA, competitive
        intelligence from watched accounts, and your braindump ideas to create a
        step-by-step content plan.
      </p>
      {error && (
        <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
          {error}
        </p>
      )}
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-opacity disabled:opacity-50"
        style={{
          letterSpacing: "1.5px",
          backgroundColor: "var(--color-brand-red)",
        }}
      >
        {generating ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            Generating…
          </>
        ) : (
          <>
            <Sparkles className="size-4" strokeWidth={1.5} />
            Generate Strategy
          </>
        )}
      </button>
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
  const [filter, setFilter] = useState<"all" | "liked" | "undecided" | "dismissed">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);

  async function loadPosts() {
    const result = await fetchInspirationFeedAction();
    if (result.ok) {
      setPosts(result.value);
    }
    setLoaded(true);
  }

  useState(() => {
    loadPosts();
  });

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

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
          Inspiration
        </h3>
        <div className="flex gap-1">
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((post) => (
          <InspirationCard
            key={post.id}
            post={post}
            expanded={expandedId === post.id}
            onToggle={() =>
              setExpandedId(expandedId === post.id ? null : post.id)
            }
            onReact={(r) => handleReact(post.id, r)}
            reacting={reacting === post.id}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
          {filter === "all"
            ? "Add watched accounts in Settings to see inspiration posts."
            : `No ${filter} posts.`}
        </div>
      )}
    </div>
  );
}

function InspirationCard({
  post,
  expanded,
  onToggle,
  onReact,
  reacting,
}: {
  post: InspirationPost;
  expanded: boolean;
  onToggle: () => void;
  onReact: (reaction: "like" | "dislike") => void;
  reacting: boolean;
}) {
  const isLiked = post.reaction === "like";
  const isDisliked = post.reaction === "dislike";

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
      {/* Image + overlay */}
      <button
        onClick={onToggle}
        className="relative block w-full"
      >
        <img
          src={post.imageUrl}
          alt=""
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
        >
          <div>
            <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "1px" }}>
              @{post.accountUsername}
            </span>
            <span className="ml-2 font-[family-name:var(--font-label)] text-[9px] text-[color:var(--color-neutral-500)]">
              {post.accountFollowers.toLocaleString()}
            </span>
          </div>
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
      </button>

      {/* Reaction buttons */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ backgroundColor: "var(--color-neutral-900)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
            style={{
              letterSpacing: "0.8px",
              background: "rgba(253, 245, 230, 0.05)",
              color:
                CONTENT_TYPE_COLORS[post.mediaType.toLowerCase()] ??
                "var(--color-neutral-400)",
            }}
          >
            {post.mediaType === "CAROUSEL_ALBUM" ? "carousel" : post.mediaType.toLowerCase()}
          </span>
          <span className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
            {post.likes.toLocaleString()} likes
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReact("like");
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              onReact("dislike");
            }}
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

      {/* Expanded detail */}
      {expanded && (
        <div
          className="border-t px-3 py-3"
          style={{ borderColor: "rgba(253, 245, 230, 0.06)" }}
        >
          {post.caption && (
            <p className="mb-2 line-clamp-4 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
              {post.caption}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex gap-3 font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
              <span>{post.likes.toLocaleString()} likes</span>
              <span>{post.comments.toLocaleString()} comments</span>
              <span>
                ER: {((post.likes + post.comments) / Math.max(post.accountFollowers, 1) * 100).toFixed(2)}%
              </span>
            </div>
            {post.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)] transition-colors hover:text-[color:var(--color-brand-cream)]"
              >
                View on Instagram →
              </a>
            )}
          </div>
          {post.whyHigh && (
            <p className="mt-2 font-[family-name:var(--font-narrative)] text-[11px] italic text-[color:var(--color-brand-pink)]">
              {post.whyHigh}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
