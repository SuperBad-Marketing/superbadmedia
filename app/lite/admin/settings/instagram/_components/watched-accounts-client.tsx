"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Eye, Users, Check } from "lucide-react";
import {
  addWatchedAccountAction,
  removeWatchedAccountAction,
  updateWatchedAccountCategoryAction,
} from "@/app/lite/content/instagram/strategy-actions";
import { WATCHED_ACCOUNT_CATEGORIES } from "@/lib/db/schema/instagram-competitive";

interface WatchedAccount {
  id: string;
  username: string;
  displayName: string | null;
  category: string;
  followers: number | null;
  postsScraped: number;
  avgEngagementRate: number | null;
  lastScrapedAtMs: number | null;
}

interface Props {
  accounts: WatchedAccount[];
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  photography_agency: {
    label: "Photography",
    color: "var(--color-brand-pink)",
  },
  content_agency: {
    label: "Content",
    color: "var(--color-brand-orange)",
  },
  wildcard: {
    label: "Wildcard",
    color: "var(--color-neutral-400)",
  },
};

export function WatchedAccountsClient({ accounts }: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [category, setCategory] = useState<string>("wildcard");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  async function handleCategoryChange(accountId: string, newCategory: string) {
    const result = await updateWatchedAccountCategoryAction({
      accountId,
      category: newCategory,
    });
    if (result.ok) {
      toast.success("Category updated.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setEditingCategory(null);
  }

  async function handleAdd() {
    if (!username.trim()) return;
    setAdding(true);
    const result = await addWatchedAccountAction({ username, category });
    if (result.ok) {
      toast.success(`@${username.replace(/^@/, "")} added.`);
      setUsername("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setAdding(false);
  }

  async function handleRemove(id: string, name: string) {
    setRemoving(id);
    const result = await removeWatchedAccountAction(id);
    if (result.ok) {
      toast.success(`@${name} removed.`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setRemoving(null);
  }

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <h3 className="mb-3 font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
          Add watched account
        </h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@username"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
              className="w-full rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)] outline-none transition-colors placeholder:text-[color:var(--color-neutral-600)] focus:border-[color:var(--color-brand-pink)]"
              style={{ borderColor: "rgba(253, 245, 230, 0.12)" }}
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none"
            style={{
              borderColor: "rgba(253, 245, 230, 0.12)",
              backgroundColor: "var(--color-neutral-900)",
            }}
          >
            {WATCHED_ACCOUNT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]?.label ?? cat}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !username.trim()}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-opacity disabled:opacity-40"
            style={{
              letterSpacing: "1.5px",
              backgroundColor: "var(--color-brand-red)",
            }}
          >
            {adding ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Plus className="size-3.5" strokeWidth={1.5} />
            )}
            Add
          </button>
        </div>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
          {accounts.length}/15 accounts · Scraped weekly via Apify
        </p>
      </div>

      {/* Account list */}
      {accounts.length > 0 && (
        <div
          className="rounded-xl border"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            borderColor: "rgba(253, 245, 230, 0.06)",
          }}
        >
          {accounts.map((account, i) => {
            const catInfo = CATEGORY_LABELS[account.category] ?? CATEGORY_LABELS.wildcard;
            return (
              <div
                key={account.id}
                className="flex items-center gap-4 px-5 py-3.5"
                style={{
                  borderTop: i > 0 ? "1px solid rgba(253, 245, 230, 0.06)" : undefined,
                }}
              >
                {/* Avatar */}
                <div
                  className="flex size-9 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[12px] text-[color:var(--color-brand-cream)]"
                  style={{ backgroundColor: "var(--color-neutral-800)" }}
                >
                  {account.username.slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                      @{account.username}
                    </span>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setEditingCategory(
                            editingCategory === account.id ? null : account.id,
                          )
                        }
                        className="rounded-full px-1.5 py-0.5 font-[family-name:var(--font-label)] text-[8px] uppercase transition-opacity hover:opacity-80"
                        style={{
                          letterSpacing: "0.8px",
                          backgroundColor: "rgba(253, 245, 230, 0.05)",
                          color: catInfo.color,
                        }}
                      >
                        {catInfo.label}
                      </button>
                      {editingCategory === account.id && (
                        <div
                          className="absolute left-0 top-full z-10 mt-1 rounded-lg border py-1 shadow-lg"
                          style={{
                            backgroundColor: "var(--color-neutral-800)",
                            borderColor: "rgba(253, 245, 230, 0.1)",
                            minWidth: "120px",
                          }}
                        >
                          {WATCHED_ACCOUNT_CATEGORIES.map((cat) => {
                            const info =
                              CATEGORY_LABELS[cat] ?? CATEGORY_LABELS.wildcard;
                            const isSelected = cat === account.category;
                            return (
                              <button
                                key={cat}
                                onClick={() =>
                                  handleCategoryChange(account.id, cat)
                                }
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-[family-name:var(--font-body)] text-[12px] transition-colors hover:bg-[color:var(--color-neutral-700)]"
                                style={{
                                  color: isSelected
                                    ? info.color
                                    : "var(--color-neutral-300)",
                                }}
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{ backgroundColor: info.color }}
                                />
                                {info.label}
                                {isSelected && (
                                  <Check
                                    className="ml-auto size-3"
                                    strokeWidth={2}
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 font-[family-name:var(--font-body)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]">
                    {account.followers !== null && (
                      <span className="flex items-center gap-1">
                        <Users className="size-3" strokeWidth={1.5} />
                        {account.followers.toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" strokeWidth={1.5} />
                      {account.postsScraped} posts
                    </span>
                    {account.avgEngagementRate !== null && (
                      <span>
                        ER: {(account.avgEngagementRate * 100).toFixed(2)}%
                      </span>
                    )}
                    {account.lastScrapedAtMs && (
                      <span>
                        Last scraped:{" "}
                        {new Date(account.lastScrapedAtMs).toLocaleDateString("en-AU", {
                          day: "numeric",
                          month: "short",
                          timeZone: "Australia/Melbourne",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove */}
                <button
                  onClick={() => handleRemove(account.id, account.username)}
                  disabled={removing === account.id}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[color:var(--color-neutral-800)]"
                  aria-label={`Remove @${account.username}`}
                >
                  {removing === account.id ? (
                    <Loader2 className="size-4 animate-spin text-[color:var(--color-neutral-500)]" strokeWidth={1.5} />
                  ) : (
                    <Trash2 className="size-4 text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-brand-red)]" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {accounts.length === 0 && (
        <div
          className="rounded-xl border py-12 text-center"
          style={{
            backgroundColor: "var(--color-neutral-900)",
            borderColor: "rgba(253, 245, 230, 0.06)",
          }}
        >
          <Eye className="mx-auto mb-3 size-8 text-[color:var(--color-neutral-600)]" strokeWidth={1} />
          <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
            No watched accounts yet
          </p>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            Add accounts above to start gathering competitive intelligence.
          </p>
        </div>
      )}

      {/* Guide */}
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <h3 className="mb-2 font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
          Choosing accounts to watch
        </h3>
        <div className="space-y-2 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-400)]">
          <p>
            <strong className="text-[color:var(--color-brand-pink)]">Photography agencies</strong> —
            accounts that shoot similar work to SuperBad. See what visual styles and formats get traction.
          </p>
          <p>
            <strong className="text-[color:var(--color-brand-orange)]">Content agencies</strong> —
            accounts that create marketing content. Learn from their posting cadence and engagement strategies.
          </p>
          <p>
            <strong className="text-[color:var(--color-neutral-300)]">Wildcards</strong> —
            any account whose content inspires you, regardless of industry. Sometimes the best ideas come from unexpected places.
          </p>
        </div>
      </div>
    </div>
  );
}
