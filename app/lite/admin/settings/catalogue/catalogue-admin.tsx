"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CATALOGUE_ITEM_UNITS,
  type CatalogueItemRow,
  type CatalogueItemUnit,
} from "@/lib/db/schema/catalogue-items";

import {
  createCatalogueItemAction,
  updateCatalogueItemAction,
  softDeleteCatalogueItemAction,
  restoreCatalogueItemAction,
} from "./actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

type Draft = {
  id: string | null;
  name: string;
  category: string;
  unit: CatalogueItemUnit;
  base_price_dollars: string;
  tier_rank: string;
  description: string;
};

const BLANK: Draft = {
  id: null,
  name: "",
  category: "",
  unit: "project",
  base_price_dollars: "0",
  tier_rank: "",
  description: "",
};

function rowToDraft(row: CatalogueItemRow): Draft {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    unit: row.unit,
    base_price_dollars: (row.base_price_cents_inc_gst / 100).toFixed(2),
    tier_rank: row.tier_rank == null ? "" : String(row.tier_rank),
    description: row.description ?? "",
  };
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CategoryChip({ category }: { category: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: "rgba(253, 245, 230, 0.06)",
        color: "var(--color-neutral-300)",
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {category}
    </span>
  );
}

const COLUMNS = [
  { label: "Name", align: "left" as const },
  { label: "Category", align: "left" as const },
  { label: "Unit", align: "left" as const },
  { label: "Price", align: "right" as const },
  { label: "", align: "right" as const },
];

export function CatalogueAdmin({
  initialItems,
}: {
  initialItems: CatalogueItemRow[];
}) {
  const [items, setItems] = React.useState<CatalogueItemRow[]>(initialItems);
  const [filter, setFilter] = React.useState<string>("__all__");
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const listTransition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setItems(initialItems), [initialItems]);

  const categories = React.useMemo(() => {
    const s = new Set<string>();
    for (const it of items) s.add(it.category);
    return Array.from(s).sort();
  }, [items]);

  const filtered = items.filter((it) => {
    if (!showDeleted && it.deleted_at_ms != null) return false;
    if (filter !== "__all__" && it.category !== filter) return false;
    return true;
  });

  function openNew() {
    setDraft({ ...BLANK });
  }

  function openEdit(row: CatalogueItemRow) {
    setDraft(rowToDraft(row));
  }

  function close() {
    setDraft(null);
  }

  function onSave() {
    if (!draft) return;
    const priceDollars = Number(draft.base_price_dollars);
    if (!Number.isFinite(priceDollars) || priceDollars < 0) {
      toast.error("Price must be a non-negative number.");
      return;
    }
    const tierRankNum =
      draft.tier_rank.trim() === "" ? null : Number(draft.tier_rank);
    if (
      tierRankNum != null &&
      (!Number.isInteger(tierRankNum) || tierRankNum < 0)
    ) {
      toast.error("Tier rank must be a non-negative integer.");
      return;
    }
    const payload = {
      name: draft.name.trim(),
      category: draft.category.trim(),
      unit: draft.unit,
      base_price_cents_inc_gst: Math.round(priceDollars * 100),
      tier_rank: tierRankNum,
      description: draft.description.trim() || null,
    };
    startTransition(async () => {
      const res = draft.id
        ? await updateCatalogueItemAction(draft.id, payload)
        : await createCatalogueItemAction(payload);
      if (res.ok) {
        toast.success(draft.id ? "Item updated." : "Item created.");
        close();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete(row: CatalogueItemRow) {
    if (
      !confirm(`Delete "${row.name}"? In-flight quotes keep their snapshot.`)
    )
      return;
    startTransition(async () => {
      const res = await softDeleteCatalogueItemAction(row.id);
      if (res.ok) toast.success("Deleted.");
      else toast.error(res.error);
    });
  }

  function onRestore(row: CatalogueItemRow) {
    startTransition(async () => {
      const res = await restoreCatalogueItemAction(row.id);
      if (res.ok) toast.success("Restored.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-[10px] px-[14px] py-3"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Category
        </span>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v ?? "__all__")}
        >
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          Show deleted
        </label>
        <div className="flex-1" />
        <button
          onClick={openNew}
          className="cursor-pointer rounded-[8px] border-none px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
          style={{
            letterSpacing: "1.8px",
            background: "var(--color-brand-red)",
            boxShadow:
              "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
          }}
        >
          New item
        </button>
      </div>

      {/* Table or empty */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-start gap-2.5 rounded-[12px] px-8 py-10"
          style={{
            border: "1px dashed rgba(253, 245, 230, 0.07)",
            background: "rgba(15, 15, 14, 0.3)",
          }}
        >
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
            style={{ letterSpacing: "2px" }}
          >
            Empty
          </div>
          <h4
            className="font-[family-name:var(--font-display)] text-[24px] leading-[1.1] text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            No catalogue items yet.
          </h4>
          <p className="max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
            Add the first priced deliverable — Quote Builder reaches into this
            list when you&apos;re assembling a quote.
          </p>
          <div className="mt-1.5 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
            still figuring out what to charge for.
          </div>
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-[12px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <table className="w-full text-left">
            <thead>
              <tr>
                {COLUMNS.map((h) => (
                  <th
                    key={h.label || "actions"}
                    className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                    style={{
                      letterSpacing: "2px",
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                      textAlign: h.align,
                      fontWeight: "normal",
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {filtered.map((it) => (
                  <motion.tr
                    key={it.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={listTransition}
                    onClick={
                      it.deleted_at_ms == null ? () => openEdit(it) : undefined
                    }
                    className={cn(
                      "cursor-pointer transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                      it.deleted_at_ms != null &&
                        "cursor-default opacity-50",
                    )}
                    whileHover={
                      it.deleted_at_ms == null
                        ? {
                            backgroundColor: "rgba(253, 245, 230, 0.025)",
                          }
                        : undefined
                    }
                  >
                    <td
                      className="font-[family-name:var(--font-body)] text-[13px] font-medium"
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        color: "var(--color-brand-cream)",
                      }}
                    >
                      <div>{it.name || <em>unnamed</em>}</div>
                      {it.description && (
                        <div className="mt-0.5 text-[12px] font-normal italic text-[color:var(--color-neutral-500)]">
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                      }}
                    >
                      <CategoryChip category={it.category} />
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[11px] text-[color:var(--color-neutral-500)]"
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        letterSpacing: "1px",
                      }}
                    >
                      /{it.unit}
                      {it.tier_rank != null && (
                        <span className="ml-1 text-[color:var(--color-neutral-600)]">
                          · tier {it.tier_rank}
                        </span>
                      )}
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[12px] tabular-nums text-[color:var(--color-brand-cream)]"
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        textAlign: "right",
                        letterSpacing: "1px",
                      }}
                    >
                      {formatMoney(it.base_price_cents_inc_gst)}
                    </td>
                    <td
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        textAlign: "right",
                      }}
                    >
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {it.deleted_at_ms == null ? (
                          <>
                            <button
                              onClick={() => openEdit(it)}
                              className="rounded-[6px] px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                              style={{
                                letterSpacing: "1.5px",
                                background: "transparent",
                                border:
                                  "1px solid rgba(253, 245, 230, 0.08)",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => onDelete(it)}
                              disabled={isPending}
                              className="rounded-[6px] px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
                              style={{
                                letterSpacing: "1.5px",
                                background: "transparent",
                                border:
                                  "1px solid rgba(253, 245, 230, 0.05)",
                              }}
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onRestore(it)}
                            disabled={isPending}
                            className="rounded-[6px] px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
                            style={{
                              letterSpacing: "1.5px",
                              background: "transparent",
                              border: "1px solid rgba(253, 245, 230, 0.05)",
                            }}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / New dialog */}
      <Dialog open={draft != null} onOpenChange={(open) => !open && close()}>
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
              {draft?.id ? "Edit catalogue item" : "New catalogue item"}
            </DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Prices are GST-inclusive. Snapshotted onto each quote on add.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <Field label="Name">
                <Input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                />
              </Field>
              <Field label="Category">
                <Input
                  value={draft.category}
                  placeholder="e.g. retainer, shoot, strategy"
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
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
                    value={draft.base_price_dollars}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        base_price_dollars: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Tier rank (retainers — optional)">
                <Input
                  type="number"
                  min={0}
                  value={draft.tier_rank}
                  onChange={(e) =>
                    setDraft({ ...draft, tier_rank: e.target.value })
                  }
                  placeholder="blank = not a retainer tier"
                />
              </Field>
              <Field label="Description">
                <Textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={close}
              disabled={isPending}
              className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
              style={{
                letterSpacing: "1.5px",
                background: "transparent",
                border: "1px solid rgba(253, 245, 230, 0.1)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isPending}
              className="rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-50"
              style={{
                letterSpacing: "1.8px",
                background: "var(--color-brand-red)",
                boxShadow:
                  "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
              }}
            >
              {isPending ? "Saving…" : "Save"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
