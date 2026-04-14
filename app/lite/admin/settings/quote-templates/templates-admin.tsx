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
  QUOTE_TEMPLATE_STRUCTURES,
  type QuoteTemplateRow,
  type QuoteTemplateStructure,
} from "@/lib/db/schema/quote-templates";
import type { CatalogueItemRow } from "@/lib/db/schema/catalogue-items";
import type {
  TemplateDefaultLineItem,
  TemplateDefaultSections,
} from "@/lib/quote-builder/templates";

import {
  createQuoteTemplateAction,
  updateQuoteTemplateAction,
  softDeleteQuoteTemplateAction,
} from "./actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

const TERM_LENGTH_CHOICES = [3, 6, 9, 12] as const;

type Draft = {
  id: string | null;
  name: string;
  structure: QuoteTemplateStructure;
  term_length_months: string; // "none" | "3" | ...
  sections: TemplateDefaultSections;
  line_items: TemplateDefaultLineItem[];
};

function newDraft(): Draft {
  return {
    id: null,
    name: "",
    structure: "project",
    term_length_months: "none",
    sections: {},
    line_items: [],
  };
}

function rowToDraft(row: QuoteTemplateRow): Draft {
  const sections = (row.default_sections_json as TemplateDefaultSections) ?? {};
  const items =
    (row.default_line_items_json as TemplateDefaultLineItem[]) ?? [];
  return {
    id: row.id,
    name: row.name,
    structure: row.structure,
    term_length_months:
      row.term_length_months == null ? "none" : String(row.term_length_months),
    sections,
    line_items: items,
  };
}

export function TemplatesAdmin({
  initialTemplates,
  catalogue,
}: {
  initialTemplates: QuoteTemplateRow[];
  catalogue: CatalogueItemRow[];
}) {
  const [templates, setTemplates] =
    React.useState<QuoteTemplateRow[]>(initialTemplates);
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const listTransition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  React.useEffect(() => setTemplates(initialTemplates), [initialTemplates]);

  const filtered = templates.filter((t) =>
    showDeleted ? true : t.deleted_at_ms == null,
  );

  function onSave() {
    if (!draft) return;
    const term =
      draft.term_length_months === "none"
        ? null
        : Number(draft.term_length_months);
    if (draft.structure === "retainer" && term == null) {
      toast.error("Retainer templates need a term length.");
      return;
    }
    const payload = {
      name: draft.name.trim(),
      structure: draft.structure,
      term_length_months: term,
      default_sections: draft.sections,
      default_line_items: draft.line_items,
    };
    startTransition(async () => {
      const res = draft.id
        ? await updateQuoteTemplateAction(draft.id, payload)
        : await createQuoteTemplateAction(payload);
      if (res.ok) {
        toast.success(draft.id ? "Template updated." : "Template created.");
        setDraft(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete(row: QuoteTemplateRow) {
    if (!confirm(`Delete template "${row.name}"?`)) return;
    startTransition(async () => {
      const res = await softDeleteQuoteTemplateAction(row.id);
      if (res.ok) toast.success("Deleted.");
      else toast.error(res.error);
    });
  }

  function addLine(item: CatalogueItemRow) {
    if (!draft) return;
    setDraft({
      ...draft,
      line_items: [
        ...draft.line_items,
        {
          catalogue_item_id: item.id,
          qty: 1,
          override_price_cents_inc_gst: null,
          kind:
            item.tier_rank != null || item.unit === "month"
              ? "retainer"
              : "one_off",
        },
      ],
    });
  }

  function removeLine(index: number) {
    if (!draft) return;
    const next = [...draft.line_items];
    next.splice(index, 1);
    setDraft({ ...draft, line_items: next });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
          />
          Show deleted
        </label>
        <Button className="ml-auto" size="sm" onClick={() => setDraft(newDraft())}>
          + New template
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm italic text-muted-foreground">
            No templates yet. Save a structural scaffold from any quote and it
            lands here.
          </p>
        ) : (
          <ul>
            <AnimatePresence initial={false}>
              {filtered.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={listTransition}
                  className={cn(
                    "grid grid-cols-[1fr_140px_100px_auto] items-center gap-3 border-b border-border/60 px-3 py-2 text-sm last:border-b-0",
                    t.deleted_at_ms != null && "opacity-50",
                  )}
                >
                  <span className="font-medium">{t.name}</span>
                  <Badge variant="outline" className="justify-self-start text-[10px]">
                    {t.structure}
                    {t.term_length_months != null
                      ? ` · ${t.term_length_months}m`
                      : ""}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    used {t.usage_count}×
                  </span>
                  <div className="flex gap-1">
                    {t.deleted_at_ms == null ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDraft(rowToDraft(t))}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(t)}
                          disabled={isPending}
                        >
                          Delete
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">deleted</span>
                    )}
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <Dialog open={draft != null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit template" : "New template"}
            </DialogTitle>
            <DialogDescription>
              Structure, default items, default terms. Client-specific prose is
              never saved here.
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Structure">
                  <Select
                    value={draft.structure}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        structure: v as QuoteTemplateStructure,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_TEMPLATE_STRUCTURES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Term length">
                  <Select
                    value={draft.term_length_months}
                    onValueChange={(v) =>
                      setDraft({ ...draft, term_length_months: v ?? "none" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No commitment</SelectItem>
                      {TERM_LENGTH_CHOICES.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Scope prose (§2 default)">
                <Textarea
                  rows={2}
                  value={draft.sections.whatWellDo_prose ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sections: {
                        ...draft.sections,
                        whatWellDo_prose: e.target.value,
                      },
                    })
                  }
                />
              </Field>

              <Field label="Terms overrides (§4 default)">
                <Textarea
                  rows={2}
                  value={draft.sections.terms_overrides_prose ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      sections: {
                        ...draft.sections,
                        terms_overrides_prose: e.target.value,
                      },
                    })
                  }
                />
              </Field>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Default line items
                </div>
                {draft.line_items.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">
                    None. Add from the catalogue below.
                  </p>
                )}
                {draft.line_items.map((li, i) => {
                  const cat = catalogue.find((c) => c.id === li.catalogue_item_id);
                  return (
                    <div
                      key={`${li.catalogue_item_id}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-xs"
                    >
                      <span className="flex-1">
                        {cat?.name ?? <em>{li.catalogue_item_id}</em>}
                      </span>
                      <span className="text-muted-foreground">× {li.qty}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {li.kind}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(i)}
                      >
                        ×
                      </Button>
                    </div>
                  );
                })}
                <CataloguePickRow catalogue={catalogue} onPick={addLine} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={isPending}
            >
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

function CataloguePickRow({
  catalogue,
  onPick,
}: {
  catalogue: CatalogueItemRow[];
  onPick: (item: CatalogueItemRow) => void;
}) {
  const [value, setValue] = React.useState<string>("");
  if (catalogue.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Catalogue is empty — add items at /lite/admin/settings/catalogue.
      </p>
    );
  }
  return (
    <div className="flex gap-2">
      <Select
        value={value}
        onValueChange={(v) => {
          if (!v) return;
          const item = catalogue.find((c) => c.id === v);
          if (item) {
            onPick(item);
            setValue("");
          }
        }}
      >
        <SelectTrigger className="h-8 flex-1">
          <SelectValue placeholder="Add from catalogue…" />
        </SelectTrigger>
        <SelectContent>
          {catalogue.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} ({c.category})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
