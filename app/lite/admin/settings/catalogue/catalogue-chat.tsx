"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MessageSquare, Send, Check, Pencil, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOGUE_ITEM_UNITS,
  type CatalogueItemUnit,
} from "@/lib/db/schema/catalogue-items";
import {
  catalogueChatAction,
  type CatalogueRecommendation,
} from "./chat-action";
import { createCatalogueItemAction } from "./actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  recommendations?: CatalogueRecommendation[];
};

type CardState = "pending" | "approved" | "dismissed";

function formatPrice(dollars: number): string {
  return `$${dollars.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function RecommendationCard({
  rec,
  onApprove,
  onEdit,
  onDismiss,
  state,
  approving,
}: {
  rec: CatalogueRecommendation;
  onApprove: () => void;
  onEdit: () => void;
  onDismiss: () => void;
  state: CardState;
  approving: boolean;
}) {
  if (state === "dismissed") return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={HOUSE_SPRING}
      className="rounded-[10px] p-3"
      style={{
        background: state === "approved"
          ? "rgba(123, 174, 126, 0.08)"
          : "rgba(253, 245, 230, 0.03)",
        border: state === "approved"
          ? "1px solid rgba(123, 174, 126, 0.2)"
          : "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
              {rec.name}
            </span>
            <span
              className="inline-flex shrink-0 items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
              style={{
                letterSpacing: "1.2px",
                background: "rgba(253, 245, 230, 0.05)",
                color: "var(--color-neutral-400)",
              }}
            >
              {rec.category}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-[family-name:var(--font-label)] text-[12px] tabular-nums text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "0.5px" }}>
              {formatPrice(rec.price_dollars)}
            </span>
            <span className="text-[color:var(--color-neutral-600)]">/</span>
            <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
              {rec.unit}
            </span>
          </div>
          {rec.description && (
            <p className="mt-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]">
              {rec.description}
            </p>
          )}
          <p className="mt-1 font-[family-name:var(--font-narrative)] text-[11px] italic text-[color:var(--color-neutral-500)]">
            {rec.rationale}
          </p>
        </div>
      </div>

      {state === "approved" ? (
        <div className="mt-2.5 flex items-center gap-1.5">
          <Check className="size-3 text-[color:var(--color-success)]" strokeWidth={2} />
          <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-success)]" style={{ letterSpacing: "1.5px" }}>
            Added to catalogue
          </span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            onClick={onApprove}
            disabled={approving}
            className="flex cursor-pointer items-center gap-1 rounded-[6px] border-none px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-50"
            style={{
              letterSpacing: "1.5px",
              background: "var(--color-brand-red)",
              boxShadow: "0 2px 8px rgba(178, 40, 72, 0.2)",
            }}
          >
            {approving ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={2} />
            ) : (
              <Check className="size-3" strokeWidth={2} />
            )}
            Approve
          </button>
          <button
            onClick={onEdit}
            className="flex cursor-pointer items-center gap-1 rounded-[6px] px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
            style={{
              letterSpacing: "1.5px",
              background: "transparent",
              border: "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            <Pencil className="size-3" strokeWidth={1.5} />
            Edit
          </button>
          <button
            onClick={onDismiss}
            className="flex cursor-pointer items-center gap-1 rounded-[6px] border-none bg-transparent px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            <X className="size-3" strokeWidth={1.5} />
            Skip
          </button>
        </div>
      )}
    </motion.div>
  );
}

type EditDraft = {
  name: string;
  category: string;
  unit: CatalogueItemUnit;
  price_dollars: string;
  description: string;
};

function EditDialog({
  open,
  rec,
  onClose,
  onSave,
}: {
  open: boolean;
  rec: CatalogueRecommendation | null;
  onClose: () => void;
  onSave: (draft: EditDraft) => void;
}) {
  const [draft, setDraft] = React.useState<EditDraft>({
    name: "",
    category: "",
    unit: "project",
    price_dollars: "0",
    description: "",
  });

  React.useEffect(() => {
    if (rec) {
      setDraft({
        name: rec.name,
        category: rec.category,
        unit: (CATALOGUE_ITEM_UNITS.includes(rec.unit as CatalogueItemUnit)
          ? rec.unit
          : "project") as CatalogueItemUnit,
        price_dollars: rec.price_dollars.toFixed(2),
        description: rec.description ?? "",
      });
    }
  }, [rec]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        style={{
          background: "var(--color-surface-2)",
          borderRadius: "12px",
          border: "1px solid rgba(253, 245, 230, 0.06)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="font-[family-name:var(--font-display)] text-[22px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            Edit before adding
          </DialogTitle>
          <DialogDescription className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            Tweak the AI recommendation before it hits the catalogue.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Category">
            <Input
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <Select
                value={draft.unit}
                onValueChange={(v) =>
                  setDraft({ ...draft, unit: v as CatalogueItemUnit })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATALOGUE_ITEM_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price (inc GST)">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={draft.price_dollars}
                onChange={(e) =>
                  setDraft({ ...draft, price_dollars: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Description">
            <Input
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </Field>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
            style={{
              letterSpacing: "1.5px",
              background: "transparent",
              border: "1px solid rgba(253, 245, 230, 0.1)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(draft)}
            className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
            style={{
              letterSpacing: "1.8px",
              background: "var(--color-brand-red)",
              boxShadow:
                "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
            }}
          >
            Add to catalogue
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function CatalogueChat() {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<ChatEntry[]>([]);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [cardStates, setCardStates] = React.useState<Record<string, CardState>>({});
  const [approvingKey, setApprovingKey] = React.useState<string | null>(null);
  const [editRec, setEditRec] = React.useState<{ rec: CatalogueRecommendation; entryId: string; idx: number } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  async function handleSend() {
    const msg = input.trim();
    if (!msg || sending) return;

    const userEntry: ChatEntry = {
      id: `u-${Date.now()}`,
      role: "user",
      text: msg,
    };
    setEntries((prev) => [...prev, userEntry]);
    setInput("");
    setSending(true);

    try {
      const res = await catalogueChatAction(msg);

      if (res.ok) {
        const assistantEntry: ChatEntry = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res.message,
          recommendations: res.recommendations,
        };
        setEntries((prev) => [...prev, assistantEntry]);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  function cardKey(entryId: string, idx: number) {
    return `${entryId}-${idx}`;
  }

  async function handleApprove(
    rec: CatalogueRecommendation,
    entryId: string,
    idx: number,
  ) {
    const key = cardKey(entryId, idx);
    setApprovingKey(key);

    const res = await createCatalogueItemAction({
      name: rec.name,
      category: rec.category,
      unit: rec.unit,
      base_price_cents_inc_gst: Math.round(rec.price_dollars * 100),
      tier_rank: null,
      description: rec.description || null,
    });

    if (res.ok) {
      setCardStates((prev) => ({ ...prev, [key]: "approved" }));
      toast.success(`${rec.name} added.`);
    } else {
      toast.error(res.error);
    }
    setApprovingKey(null);
  }

  async function handleEditSave(draft: EditDraft) {
    if (!editRec) return;
    const key = cardKey(editRec.entryId, editRec.idx);
    setApprovingKey(key);

    const priceDollars = Number(draft.price_dollars);
    if (!Number.isFinite(priceDollars) || priceDollars < 0) {
      toast.error("Price must be a non-negative number.");
      setApprovingKey(null);
      return;
    }

    const res = await createCatalogueItemAction({
      name: draft.name.trim(),
      category: draft.category.trim(),
      unit: draft.unit,
      base_price_cents_inc_gst: Math.round(priceDollars * 100),
      tier_rank: null,
      description: draft.description.trim() || null,
    });

    if (res.ok) {
      setCardStates((prev) => ({ ...prev, [key]: "approved" }));
      toast.success(`${draft.name} added.`);
      setEditRec(null);
    } else {
      toast.error(res.error);
    }
    setApprovingKey(null);
  }

  return (
    <>
      {/* Toggle button */}
      <motion.button
        onClick={() => setOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1.5 rounded-[8px] border-none px-3 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          letterSpacing: "1.5px",
          background: open
            ? "rgba(244, 160, 176, 0.12)"
            : "rgba(253, 245, 230, 0.05)",
          color: open
            ? "var(--color-brand-pink)"
            : "var(--color-neutral-400)",
          border: `1px solid ${open ? "rgba(244, 160, 176, 0.2)" : "rgba(253, 245, 230, 0.08)"}`,
        }}
        whileHover={{ y: -1 }}
        transition={HOUSE_SPRING}
      >
        <MessageSquare className="size-3.5" strokeWidth={1.5} />
        AI Chat
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={HOUSE_SPRING}
            className="overflow-hidden"
          >
            <div
              className="mt-3 flex flex-col rounded-[12px]"
              style={{
                background: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
                border: "1px solid rgba(253, 245, 230, 0.04)",
                maxHeight: "520px",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                }}
              >
                <MessageSquare
                  className="size-4 text-[color:var(--color-brand-pink)]"
                  strokeWidth={1.5}
                />
                <span
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Catalogue Assistant
                </span>
                <span className="ml-auto font-[family-name:var(--font-narrative)] text-[11px] italic text-[color:var(--color-neutral-600)]">
                  describe what you want to charge for
                </span>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
                style={{ maxHeight: "380px" }}
              >
                {entries.length === 0 && (
                  <div className="flex flex-col items-center py-8">
                    <p
                      className="font-[family-name:var(--font-display)] text-[18px] leading-none text-[color:var(--color-brand-cream)]"
                      style={{ letterSpacing: "-0.2px" }}
                    >
                      What should be on the menu?
                    </p>
                    <p className="mt-2 max-w-[340px] text-center font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                      Describe a package, service, or deliverable and I&apos;ll
                      recommend catalogue items with pricing.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {[
                        "a full retainer package",
                        "half day shoot",
                        "social media management",
                        "brand strategy session",
                      ].map((hint) => (
                        <button
                          key={hint}
                          onClick={() => {
                            setInput(hint);
                          }}
                          className="cursor-pointer rounded-full border-none px-2.5 py-1 font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-400)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                          style={{
                            background: "rgba(253, 245, 230, 0.04)",
                          }}
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {entries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={HOUSE_SPRING}
                    >
                      {entry.role === "user" ? (
                        <div className="flex justify-end">
                          <div
                            className="max-w-[80%] rounded-[10px] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)]"
                            style={{
                              background: "rgba(244, 160, 176, 0.1)",
                              border:
                                "1px solid rgba(244, 160, 176, 0.15)",
                            }}
                          >
                            {entry.text}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {entry.text && (
                            <div
                              className="max-w-[90%] rounded-[10px] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-300)]"
                              style={{
                                background: "rgba(253, 245, 230, 0.03)",
                                border:
                                  "1px solid rgba(253, 245, 230, 0.05)",
                              }}
                            >
                              {entry.text}
                            </div>
                          )}
                          {entry.recommendations?.map((rec, idx) => {
                            const key = cardKey(entry.id, idx);
                            return (
                              <RecommendationCard
                                key={key}
                                rec={rec}
                                state={cardStates[key] ?? "pending"}
                                approving={approvingKey === key}
                                onApprove={() =>
                                  handleApprove(rec, entry.id, idx)
                                }
                                onEdit={() =>
                                  setEditRec({
                                    rec,
                                    entryId: entry.id,
                                    idx,
                                  })
                                }
                                onDismiss={() =>
                                  setCardStates((prev) => ({
                                    ...prev,
                                    [key]: "dismissed",
                                  }))
                                }
                              />
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {sending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 py-2"
                  >
                    <Loader2
                      className="size-3.5 animate-spin text-[color:var(--color-brand-pink)]"
                      strokeWidth={1.5}
                    />
                    <span className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-neutral-500)]">
                      thinking about pricing…
                    </span>
                  </motion.div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2 px-4 py-3"
                style={{
                  borderTop: "1px solid rgba(253, 245, 230, 0.05)",
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. a full retainer package with monthly shoots…"
                  disabled={sending}
                  className="flex-1 text-[13px]"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="flex cursor-pointer items-center justify-center rounded-[8px] border-none p-2 transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-30"
                  style={{
                    background: "var(--color-brand-red)",
                    boxShadow:
                      "0 2px 8px rgba(178, 40, 72, 0.2)",
                  }}
                >
                  <Send
                    className="size-3.5 text-[color:var(--color-brand-cream)]"
                    strokeWidth={2}
                  />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit dialog */}
      <EditDialog
        open={editRec != null}
        rec={editRec?.rec ?? null}
        onClose={() => setEditRec(null)}
        onSave={handleEditSave}
      />
    </>
  );
}
