"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Zap,
  Plus,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Search,
  MessageCircle,
  Send,
  RotateCcw,
  Image as ImageIcon,
} from "lucide-react";
import {
  listTriggersAction,
  getPostsForPickerAction,
  createTriggerAction,
  toggleTriggerAction,
  deleteTriggerAction,
  draftTriggerDmAction,
  getTriggerFiresAction,
  retryFailedFiresAction,
  type TriggerItem,
  type PostPickerItem,
  type TriggerFireItem,
} from "../trigger-actions";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AutomationPanel() {
  const [triggers, setTriggers] = useState<TriggerItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreator, setShowCreator] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTriggersAction().then((result) => {
      if (!cancelled && result.ok) setTriggers(result.value);
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  function handleCreated() {
    setShowCreator(false);
    listTriggersAction().then((result) => {
      if (result.ok) setTriggers(result.value);
    });
  }

  async function handleToggle(id: string, isActive: boolean) {
    const result = await toggleTriggerAction(id, isActive);
    if (result.ok) {
      setTriggers((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive } : t)),
      );
    } else {
      toast.error(result.error);
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteTriggerAction(id);
    if (result.ok) {
      setTriggers((prev) => prev.filter((t) => t.id !== id));
      toast.success("Automation deleted.");
    } else {
      toast.error(result.error);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-lg"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap
            className="size-4 text-[color:var(--color-brand-orange)]"
            strokeWidth={1.5}
          />
          <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
            Comment automations
          </span>
          {triggers.length > 0 && (
            <span className="font-[family-name:var(--font-label)] text-[9px] tabular-nums text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "0.5px" }}>
              {triggers.filter((t) => t.isActive).length} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreator(!showCreator)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
          }}
        >
          <Plus className="size-3" strokeWidth={2} />
          New automation
        </button>
      </div>

      {/* Creator */}
      {showCreator && (
        <TriggerCreator
          onCreated={handleCreated}
          onCancel={() => setShowCreator(false)}
        />
      )}

      {/* Active automations list */}
      {triggers.length === 0 && !showCreator ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            borderColor: "rgba(253, 245, 230, 0.06)",
          }}
        >
          <Zap
            className="mx-auto mb-3 size-8 text-[color:var(--color-neutral-700)]"
            strokeWidth={1}
          />
          <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)] text-pretty">
            No automations yet.
          </p>
          <p className="mt-1 max-w-[360px] mx-auto font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)] text-pretty">
            Set up a trigger to auto-DM anyone who comments — on a specific post or across all posts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              onToggle={(active) => handleToggle(trigger.id, active)}
              onDelete={() => handleDelete(trigger.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Trigger Creator ─────────────────────────────────────────────────────

function TriggerCreator({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"pick_post" | "set_trigger" | "set_dm">(
    "pick_post",
  );
  const [posts, setPosts] = useState<PostPickerItem[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<PostPickerItem | null>(null);
  const [allPosts, setAllPosts] = useState(false);
  const [triggerType, setTriggerType] = useState<"any_comment" | "keyword_match">("any_comment");
  const [keyword, setKeyword] = useState("");
  const [dmText, setDmText] = useState("");
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPostsForPickerAction(100).then((result) => {
      if (!cancelled && result.ok) setPosts(result.value);
      if (!cancelled) setPostsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredPosts = search
    ? posts.filter(
        (p) =>
          (p.caption ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : posts;

  async function handleDraft() {
    if (!brief.trim()) return;
    setDrafting(true);
    const result = await draftTriggerDmAction(
      brief,
      selectedPost?.caption ?? null,
    );
    if (result.ok) {
      setDmText(result.value);
    } else {
      toast.error(result.error);
    }
    setDrafting(false);
  }

  async function handleSave() {
    if ((!selectedPost && !allPosts) || !dmText.trim()) return;
    setSaving(true);
    const result = await createTriggerAction({
      mediaId: allPosts ? null : selectedPost!.id,
      triggerType,
      keyword: triggerType === "keyword_match" ? keyword : undefined,
      dmMessageText: dmText.trim(),
    });
    if (result.ok) {
      toast.success("Automation created.");
      onCreated();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  }

  const STEPS = [
    { key: "pick_post", label: "Pick post" },
    { key: "set_trigger", label: "Set trigger" },
    { key: "set_dm", label: "DM content" },
  ] as const;

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(242, 140, 82, 0.2)",
      }}
    >
      {/* Step indicator */}
      <div className="mb-4 flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isCurrent = s.key === step;
          const isPast =
            STEPS.findIndex((x) => x.key === step) > i;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className="h-px w-6"
                  style={{
                    backgroundColor: isPast
                      ? "var(--color-brand-orange)"
                      : "rgba(253, 245, 230, 0.1)",
                  }}
                />
              )}
              <div className="flex items-center gap-1.5">
                <span
                  className="flex size-5 items-center justify-center rounded-full font-[family-name:var(--font-label)] text-[9px] tabular-nums"
                  style={{
                    backgroundColor: isCurrent
                      ? "rgba(242, 140, 82, 0.2)"
                      : isPast
                        ? "rgba(123, 174, 126, 0.15)"
                        : "rgba(253, 245, 230, 0.06)",
                    color: isCurrent
                      ? "var(--color-brand-orange)"
                      : isPast
                        ? "#7BAE7E"
                        : "var(--color-neutral-600)",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{
                    letterSpacing: "1px",
                    color: isCurrent
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-600)",
                  }}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Pick post */}
      {step === "pick_post" && (
        <div className="space-y-3">
          {/* All posts option */}
          <button
            onClick={() => {
              setAllPosts(true);
              setSelectedPost(null);
              setStep("set_trigger");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
            style={{
              backgroundColor: "rgba(242, 140, 82, 0.08)",
              border: "1px solid rgba(242, 140, 82, 0.15)",
            }}
          >
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(242, 140, 82, 0.12)" }}
            >
              <Zap className="size-4 text-[color:var(--color-brand-orange)]" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-orange)]">
                All posts
              </p>
              <p className="mt-0.5 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                Trigger on comments across every post
              </p>
            </div>
          </button>

          <div
            className="flex items-center gap-3"
            style={{ color: "var(--color-neutral-600)" }}
          >
            <div className="h-px flex-1" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />
            <span className="font-[family-name:var(--font-label)] text-[8px] uppercase" style={{ letterSpacing: "1px" }}>
              or pick a specific post
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: "rgba(253, 245, 230, 0.06)" }} />
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--color-neutral-600)]"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts by caption…"
              className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-orange)]"
              style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
            />
          </div>

          {!postsLoaded ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
            </div>
          ) : (
            <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
              {filteredPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={() => {
                    setAllPosts(false);
                    setSelectedPost(post);
                    setStep("set_trigger");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor:
                      selectedPost?.id === post.id
                        ? "rgba(242, 140, 82, 0.1)"
                        : "rgba(253, 245, 230, 0.02)",
                  }}
                >
                  <div
                    className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                    style={{ backgroundColor: "var(--color-neutral-800)" }}
                  >
                    {post.thumbnailUrl ? (
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="size-10 object-cover"
                      />
                    ) : (
                      <ImageIcon
                        className="size-4 text-[color:var(--color-neutral-700)]"
                        strokeWidth={1.5}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-300)]">
                      {post.caption
                        ? post.caption.slice(0, 80) +
                          (post.caption.length > 80 ? "…" : "")
                        : "No caption"}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
                        {post.mediaType.replace("_", " ")}
                      </span>
                      {post.commentsCount != null && (
                        <span className="flex items-center gap-0.5 font-[family-name:var(--font-body)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
                          <MessageCircle className="size-2.5" strokeWidth={1.5} />
                          {post.commentsCount}
                        </span>
                      )}
                      <span className="font-[family-name:var(--font-body)] text-[10px] tabular-nums text-[color:var(--color-neutral-600)]">
                        {timeAgo(post.publishedAtMs)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {filteredPosts.length === 0 && (
                <p className="py-6 text-center font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)]">
                  {search ? "No posts match your search." : "No synced posts found."}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onCancel}
              className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Set trigger */}
      {step === "set_trigger" && (selectedPost || allPosts) && (
        <div className="space-y-4">
          {/* Selected post summary */}
          <div
            className="flex items-center gap-3 rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
          >
            {allPosts ? (
              <>
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: "rgba(242, 140, 82, 0.12)" }}
                >
                  <Zap className="size-3.5 text-[color:var(--color-brand-orange)]" strokeWidth={1.5} />
                </div>
                <p className="min-w-0 flex-1 font-[family-name:var(--font-body)] text-[12px] font-medium text-[color:var(--color-brand-orange)]">
                  All posts
                </p>
              </>
            ) : (
              <>
                <div
                  className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded"
                  style={{ backgroundColor: "var(--color-neutral-800)" }}
                >
                  {selectedPost!.thumbnailUrl ? (
                    <img
                      src={selectedPost!.thumbnailUrl}
                      alt=""
                      className="size-8 object-cover"
                    />
                  ) : (
                    <ImageIcon
                      className="size-3 text-[color:var(--color-neutral-700)]"
                      strokeWidth={1.5}
                    />
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                  {selectedPost!.caption?.slice(0, 60) ?? "No caption"}
                </p>
              </>
            )}
            <button
              onClick={() => setStep("pick_post")}
              className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-pink)]"
            >
              Change
            </button>
          </div>

          {/* Trigger type */}
          <div className="space-y-2">
            <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
              Trigger when
            </span>
            <div className="flex gap-2">
              {(
                [
                  { key: "any_comment" as const, label: "Any comment" },
                  { key: "keyword_match" as const, label: "Comment contains keyword" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTriggerType(opt.key)}
                  className="rounded-lg px-3 py-2 font-[family-name:var(--font-body)] text-[12px] transition-colors"
                  style={{
                    backgroundColor:
                      triggerType === opt.key
                        ? "rgba(242, 140, 82, 0.12)"
                        : "rgba(253, 245, 230, 0.04)",
                    color:
                      triggerType === opt.key
                        ? "var(--color-brand-orange)"
                        : "var(--color-neutral-400)",
                    border: `1px solid ${
                      triggerType === opt.key
                        ? "rgba(242, 140, 82, 0.25)"
                        : "rgba(253, 245, 230, 0.06)"
                    }`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {triggerType === "keyword_match" && (
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. brand DNA, link, interested"
                className="w-full rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-orange)]"
                style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
              />
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep("pick_post")}
              className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
            >
              Back
            </button>
            <button
              onClick={() => setStep("set_dm")}
              disabled={triggerType === "keyword_match" && !keyword.trim()}
              className="rounded-lg px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-brand-orange)",
                color: "var(--color-brand-cream)",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: DM content */}
      {step === "set_dm" && (selectedPost || allPosts) && (
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
              Brief the DM
            </span>
            <p className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
              Describe what the DM should say. The LLM will draft it in SuperBad
              voice.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder='e.g. "Send them the brand DNA link: superbadmedia.com.au/dna"'
                className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)]"
                style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && brief.trim()) handleDraft();
                }}
              />
              <button
                onClick={handleDraft}
                disabled={!brief.trim() || drafting}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: "rgba(244, 160, 176, 0.15)",
                  color: "var(--color-brand-pink)",
                }}
              >
                {drafting ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Sparkles className="size-3" strokeWidth={1.5} />
                )}
                Draft
              </button>
            </div>
          </div>

          {/* DM preview/edit */}
          <div className="space-y-2">
            <span className="font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
              DM message
            </span>
            <textarea
              value={dmText}
              onChange={(e) => setDmText(e.target.value)}
              rows={4}
              placeholder="Draft will appear here, or type directly…"
              className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-brand-cream)] outline-none placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)]"
              style={{ borderColor: "rgba(253, 245, 230, 0.1)" }}
            />
          </div>

          {/* Summary */}
          {dmText.trim() && (
            <div
              className="rounded-lg px-3 py-2"
              style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
            >
              <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
                Summary
              </span>
              <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
                When{" "}
                {triggerType === "any_comment"
                  ? "anyone comments"
                  : `a comment contains "${keyword}"`}{" "}
                on {allPosts ? "any post" : "this post"}, send them this DM automatically.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep("set_trigger")}
              className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
            >
              Back
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!dmText.trim() || saving}
                className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-opacity disabled:opacity-40"
                style={{
                  backgroundColor: "var(--color-brand-red)",
                  color: "var(--color-brand-cream)",
                }}
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Zap className="size-3" strokeWidth={1.5} />
                )}
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trigger Card ────────────────────────────────────────────────────────

function TriggerCard({
  trigger,
  onToggle,
  onDelete,
}: {
  trigger: TriggerItem;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fires, setFires] = useState<TriggerFireItem[]>([]);
  const [firesLoaded, setFiresLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function loadFires() {
    if (firesLoaded) return;
    const result = await getTriggerFiresAction(trigger.id);
    if (result.ok) setFires(result.value);
    setFiresLoaded(true);
  }

  function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) loadFires();
  }

  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: trigger.isActive
          ? "rgba(242, 140, 82, 0.15)"
          : "rgba(253, 245, 230, 0.06)",
        opacity: trigger.isActive ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Post thumbnail */}
        <div
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: trigger.mediaId ? "var(--color-neutral-800)" : "rgba(242, 140, 82, 0.12)" }}
        >
          {!trigger.mediaId ? (
            <Zap className="size-3.5 text-[color:var(--color-brand-orange)]" strokeWidth={1.5} />
          ) : trigger.mediaThumbnail ? (
            <img
              src={trigger.mediaThumbnail}
              alt=""
              className="size-9 object-cover"
            />
          ) : (
            <ImageIcon
              className="size-3.5 text-[color:var(--color-neutral-700)]"
              strokeWidth={1.5}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-body)] text-[12px] font-medium text-[color:var(--color-brand-cream)]">
              {trigger.triggerType === "any_comment"
                ? "Any comment"
                : `"${trigger.keyword}"`}
            </span>
            <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
              → DM
            </span>
            {trigger.isActive ? (
              <span
                className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                style={{
                  letterSpacing: "0.8px",
                  backgroundColor: "rgba(123, 174, 126, 0.12)",
                  color: "#7BAE7E",
                }}
              >
                Active
              </span>
            ) : (
              <span
                className="rounded px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase"
                style={{
                  letterSpacing: "0.8px",
                  backgroundColor: "rgba(253, 245, 230, 0.05)",
                  color: "var(--color-neutral-600)",
                }}
              >
                Paused
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
            {trigger.mediaId
              ? (trigger.mediaCaption?.slice(0, 60) ?? "No caption")
              : "All posts"}
          </p>
        </div>

        {/* Stats + actions */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <Send className="size-3 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
            <span className="font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
              {trigger.firesCount}
            </span>
          </div>

          <button
            onClick={() => onToggle(!trigger.isActive)}
            className="flex size-7 items-center justify-center rounded-full transition-colors"
            aria-label={trigger.isActive ? "Pause automation" : "Activate automation"}
            style={{
              backgroundColor: trigger.isActive
                ? "rgba(123, 174, 126, 0.1)"
                : "rgba(253, 245, 230, 0.05)",
            }}
          >
            {trigger.isActive ? (
              <Power className="size-3.5 text-[#7BAE7E]" strokeWidth={1.5} />
            ) : (
              <PowerOff className="size-3.5 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
            )}
          </button>

          <button
            onClick={handleExpand}
            className="flex size-7 items-center justify-center"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="size-4 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
            ) : (
              <ChevronDown className="size-4 text-[color:var(--color-neutral-600)]" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "rgba(253, 245, 230, 0.04)" }}
        >
          {/* DM preview */}
          <div
            className="mb-3 rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(253, 245, 230, 0.03)" }}
          >
            <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
              DM message
            </span>
            <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
              {trigger.dmMessageText}
            </p>
          </div>

          {/* Recent fires */}
          {fires.length > 0 && (
            <div className="mb-3">
              <span className="font-[family-name:var(--font-label)] text-[8px] uppercase text-[color:var(--color-neutral-600)]" style={{ letterSpacing: "0.8px" }}>
                Recent activity
              </span>
              <div className="mt-1.5 space-y-1">
                {fires.slice(0, 5).map((fire) => (
                  <div
                    key={fire.id}
                    className="flex items-center gap-2 font-[family-name:var(--font-body)] text-[11px]"
                  >
                    <span
                      className="inline-block size-1.5 rounded-full"
                      style={{
                        backgroundColor: fire.dmSent
                          ? "#7BAE7E"
                          : "var(--color-brand-red)",
                      }}
                    />
                    <span className="text-[color:var(--color-neutral-400)]">
                      @{fire.commenterUsername}
                    </span>
                    <span className="text-[color:var(--color-neutral-600)]">
                      {fire.dmSent ? "DM sent" : fire.error ?? "Failed"}
                    </span>
                    <span className="ml-auto tabular-nums text-[color:var(--color-neutral-600)]">
                      {timeAgo(fire.firedAtMs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {firesLoaded && fires.length === 0 && trigger.firesCount === 0 && (
            <p className="mb-3 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-600)]">
              No fires yet. DMs will be sent automatically when matching comments arrive.
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {/* Retry failed */}
            {fires.some((f) => !f.dmSent) ? (
              <button
                onClick={async () => {
                  setRetrying(true);
                  const result = await retryFailedFiresAction(trigger.id);
                  if (result.ok) {
                    const { retried, succeeded } = result.value;
                    if (succeeded === retried) {
                      toast.success(`${succeeded} DM${succeeded !== 1 ? "s" : ""} sent.`);
                    } else {
                      toast.error(`${succeeded}/${retried} succeeded. Check errors below.`);
                    }
                    setFiresLoaded(false);
                    const fresh = await getTriggerFiresAction(trigger.id);
                    if (fresh.ok) setFires(fresh.value);
                    setFiresLoaded(true);
                  } else {
                    toast.error(result.error);
                  }
                  setRetrying(false);
                }}
                disabled={retrying}
                className="flex items-center gap-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-brand-orange)] transition-colors hover:text-[color:var(--color-brand-cream)] disabled:opacity-40"
              >
                {retrying ? (
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                ) : (
                  <RotateCcw className="size-3" strokeWidth={1.5} />
                )}
                {retrying ? "Retrying…" : "Retry failed"}
              </button>
            ) : (
              <div />
            )}

            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onDelete}
                  className="rounded-md px-2.5 py-1 font-[family-name:var(--font-label)] text-[9px] uppercase tracking-[1px] text-[color:var(--color-brand-cream)]"
                  style={{ backgroundColor: "var(--color-brand-red)" }}
                >
                  Delete
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
                className="flex items-center gap-1 text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]"
              >
                <Trash2 className="size-3" strokeWidth={1.5} />
                <span className="font-[family-name:var(--font-body)] text-[11px]">
                  Delete
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
