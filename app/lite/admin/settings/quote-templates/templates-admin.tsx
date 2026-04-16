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

const STRUCTURE_TONE: Record<
  QuoteTemplateStructure,
  { bg: string; color: string }
> = {
  retainer: {
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  project: {
    bg: "rgba(242, 140, 82, 0.12)",
    color: "var(--color-brand-orange)",
  },
  mixed: {
    bg: "rgba(228, 176, 98, 0.12)",
    color: "var(--color-warning)",
  },
};

function StructureChip({ structure }: { structure: QuoteTemplateStructure }) {
  const tone = STRUCTURE_TONE[structure];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {structure}
    </span>
  );
}

type Draft = {
  id: string | null;
  name: string;
  structure: QuoteTemplateStructure;
  term_length_months: string;
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
  const sections =
    (row.default_sections_json as TemplateDefaultSections) ?? {};
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

const COLUMNS = [
  { label: "Name", align: "left" as const },
  { label: "Structure", align: "left" as const },
  { label: "Term", align: "left" as const },
  { label: "Usage", align: "right" as const },
  { label: "", align: "right" as const },
];

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
    <div className="space-y-4 px-4 pb-6">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 rounded-[10px] px-[14px] py-3"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
        }}
      >
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
          onClick={() => setDraft(newDraft())}
          className="cursor-pointer rounded-[8px] border-none px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px"
          style={{
            letterSpacing: "1.8px",
            background: "var(--color-brand-red)",
            boxShadow:
              "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
          }}
        >
          New template
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
            No templates yet.
          </h4>
          <p className="max-w-[440px] font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
            Save a structural scaffold — default line items, sections, term
            length — and the next quote starts from a blueprint instead of a
            blank page.
          </p>
          <div className="mt-1.5 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
            each quote is built from scratch until one isn&apos;t.
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
                {filtered.map((t) => (
                  <motion.tr
                    key={t.id}
                    layout="position"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={listTransition}
                    onClick={
                      t.deleted_at_ms == null
                        ? () => setDraft(rowToDraft(t))
                        : undefined
                    }
                    className={cn(
                      "cursor-pointer transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
                      t.deleted_at_ms != null &&
                        "cursor-default opacity-50",
                    )}
                    whileHover={
                      t.deleted_at_ms == null
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
                      {t.name}
                    </td>
                    <td
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                      }}
                    >
                      <StructureChip structure={t.structure} />
                      {t.term_length_months != null && (
                        <span
                          className="ml-2 font-[family-name:var(--font-label)] text-[10px] text-[color:var(--color-neutral-500)]"
                          style={{ letterSpacing: "1px" }}
                        >
                          {t.term_length_months}m
                        </span>
                      )}
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[11px] text-[color:var(--color-neutral-500)]"
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        letterSpacing: "1px",
                      }}
                    >
                      {t.term_length_months != null
                        ? `${t.term_length_months} months`
                        : "—"}
                    </td>
                    <td
                      className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-400)]"
                      style={{
                        padding: "14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        textAlign: "right",
                        letterSpacing: "1px",
                      }}
                    >
                      {t.usage_count}×
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
                        {t.deleted_at_ms == null ? (
                          <>
                            <button
                              onClick={() => setDraft(rowToDraft(t))}
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
                              onClick={() => onDelete(t)}
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
                          <span className="font-[family-name:var(--font-label)] text-[10px] italic text-[color:var(--color-neutral-500)]">
                            deleted
                          </span>
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
      <Dialog
        open={draft != null}
        onOpenChange={(open) => !open && setDraft(null)}
      >
        <DialogContent
          className="sm:max-w-xl"
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
              {draft?.id ? "Edit template" : "New template"}
            </DialogTitle>
            <DialogDescription className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              Structure, default items, default terms. Client-specific prose is
              never saved here.
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
                      setDraft({
                        ...draft,
                        term_length_months: v ?? "none",
                      })
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
                <div
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Default line items
                </div>
                {draft.line_items.length === 0 && (
                  <p className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]">
                    None. Add from the catalogue below.
                  </p>
                )}
                {draft.line_items.map((li, i) => {
                  const cat = catalogue.find(
                    (c) => c.id === li.catalogue_item_id,
                  );
                  return (
                    <div
                      key={`${li.catalogue_item_id}-${i}`}
                      className="flex items-center gap-2 rounded-[8px] p-2 text-[12px]"
                      style={{
                        border: "1px solid rgba(253, 245, 230, 0.04)",
                        background: "rgba(15, 15, 14, 0.3)",
                      }}
                    >
                      <span className="flex-1 font-[family-name:var(--font-body)] text-[color:var(--color-neutral-300)]">
                        {cat?.name ?? (
                          <em className="text-[color:var(--color-neutral-500)]">
                            {li.catalogue_item_id}
                          </em>
                        )}
                      </span>
                      <span className="font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]">
                        × {li.qty}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none text-[color:var(--color-neutral-400)]"
                        style={{
                          letterSpacing: "1px",
                          background: "rgba(253, 245, 230, 0.05)",
                        }}
                      >
                        {li.kind}
                      </span>
                      <button
                        onClick={() => removeLine(i)}
                        className="rounded px-1.5 py-0.5 text-[12px] text-[color:var(--color-neutral-500)] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                        style={{ background: "transparent", border: "none" }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                <CataloguePickRow catalogue={catalogue} onPick={addLine} />
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setDraft(null)}
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
      <p className="font-[family-name:var(--font-body)] text-[12px] italic text-[color:var(--color-neutral-500)]">
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
