"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    if (tierRankNum != null && (!Number.isInteger(tierRankNum) || tierRankNum < 0)) {
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
    if (!confirm(`Delete "${row.name}"? In-flight quotes keep their snapshot.`)) return;
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">
          Category
        </label>
        <Select value={filter} onValueChange={(v) => setFilter(v ?? "__all__")}>
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
        <label className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          Show deleted
        </label>
        <Button className="ml-auto" onClick={openNew} size="sm">
          + New item
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm italic text-muted-foreground">
            Nothing here yet. Add the first priced deliverable.
          </p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {filtered.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={listTransition}
                  className={cn(
                    "grid grid-cols-[1fr_120px_100px_100px_auto] items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0",
                    it.deleted_at_ms != null && "opacity-50",
                  )}
                >
                  <div>
                    <div className="font-medium">{it.name || <em>unnamed</em>}</div>
                    {it.description && (
                      <div className="text-xs text-muted-foreground">
                        {it.description}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="justify-self-start text-[10px]">
                    {it.category}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    /{it.unit}
                    {it.tier_rank != null && ` · tier ${it.tier_rank}`}
                  </span>
                  <span className="font-mono text-xs">
                    {formatMoney(it.base_price_cents_inc_gst)}
                  </span>
                  <div className="flex gap-1">
                    {it.deleted_at_ms == null ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(it)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(it)}
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRestore(it)}
                        disabled={isPending}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Dialog open={draft != null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit catalogue item" : "New catalogue item"}
            </DialogTitle>
            <DialogDescription>
              Prices are GST-inclusive. Snapshotted onto each quote on add.
            </DialogDescription>
          </DialogHeader>
          {draft && (
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
            <Button variant="ghost" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
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
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
