"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { ProposalRow } from "@/lib/db/schema/proposals";
import {
  SECTION_TYPE_LABELS,
  type ProposalSection,
  type ProposalSectionType,
} from "@/lib/proposal-builder/content-shape";
import {
  getProposalAction,
  updateSectionsAction,
  addSectionAction,
  removeSectionAction,
  moveSectionAction,
  downloadProposalPdfAction,
} from "../actions";

const ALL_SECTION_TYPES: ProposalSectionType[] = [
  "cover",
  "opportunity",
  "concept",
  "ecosystem",
  "advantages",
  "investment",
  "next_steps",
  "text_block",
  "two_column",
];

export default function ProposalEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [saving, startSaving] = useTransition();
  const [exporting, startExporting] = useTransition();
  const [showAddSection, setShowAddSection] = useState(false);

  useEffect(() => {
    getProposalAction(id).then((res) => {
      if (res.ok) {
        setProposal(res.proposal);
        setSections(res.proposal.sections_json as ProposalSection[]);
      }
    });
  }, [id]);

  const saveDebounced = useCallback(
    (updated: ProposalSection[]) => {
      startSaving(async () => {
        await updateSectionsAction({ proposalId: id, sections: updated });
      });
    },
    [id],
  );

  function updateSection(index: number, updated: ProposalSection) {
    setSections((prev) => {
      const next = [...prev];
      next[index] = updated;
      saveDebounced(next);
      return next;
    });
  }

  function handleAddSection(type: ProposalSectionType) {
    startSaving(async () => {
      const res = await addSectionAction({
        proposalId: id,
        sectionType: type,
        insertAt: activeSection + 1,
      });
      if (res.ok) {
        setSections(res.sections);
        setActiveSection(activeSection + 1);
        setShowAddSection(false);
        toast.success(`Added ${SECTION_TYPE_LABELS[type]}`);
      }
    });
  }

  function handleRemoveSection(index: number) {
    if (sections.length <= 1) {
      toast.error("Proposal needs at least one section.");
      return;
    }
    startSaving(async () => {
      const res = await removeSectionAction({ proposalId: id, sectionIndex: index });
      if (res.ok) {
        setSections(res.sections);
        setActiveSection(Math.min(activeSection, res.sections.length - 1));
        toast.success("Section removed.");
      }
    });
  }

  function handleMoveSection(from: number, to: number) {
    startSaving(async () => {
      const res = await moveSectionAction({ proposalId: id, fromIndex: from, toIndex: to });
      if (res.ok) {
        setSections(res.sections);
        setActiveSection(to);
      }
    });
  }

  function handleExportPdf() {
    startExporting(async () => {
      try {
        const res = await downloadProposalPdfAction(id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("PDF downloaded.");
      } catch {
        toast.error("PDF export failed.");
      }
    });
  }

  if (!proposal) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          Loading…
        </p>
      </div>
    );
  }

  const currentSection = sections[activeSection];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Proposals{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            {proposal.proposal_number}
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          {proposal.title}
        </h1>
        <p className="mt-1 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          {proposal.client_name}
          {proposal.subtitle && ` — ${proposal.subtitle}`}
        </p>
      </header>

      {/* Toolbar */}
      <div className="mt-2 flex items-center gap-2 px-4">
        <button
          type="button"
          onClick={handleExportPdf}
          disabled={exporting}
          className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] font-medium transition-opacity"
          style={{
            backgroundColor: "var(--color-brand-red)",
            color: "var(--color-brand-cream)",
            opacity: exporting ? 0.5 : 1,
          }}
        >
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
        <button
          type="button"
          onClick={() => setShowAddSection(!showAddSection)}
          className="rounded-lg px-4 py-2 font-[family-name:var(--font-body)] text-[13px] transition-colors"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            color: "var(--color-brand-cream)",
            border: "1px solid rgba(253,245,230,0.08)",
          }}
        >
          + Add section
        </button>
        {saving && (
          <span className="ml-2 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            Saving…
          </span>
        )}
      </div>

      {showAddSection && (
        <div
          className="mx-4 mt-2 flex flex-wrap gap-2 rounded-lg p-3"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            border: "1px solid rgba(253,245,230,0.08)",
          }}
        >
          {ALL_SECTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAddSection(type)}
              className="rounded-md px-3 py-1.5 font-[family-name:var(--font-body)] text-[12px] transition-colors hover:brightness-110"
              style={{
                backgroundColor: "var(--color-neutral-700)",
                color: "var(--color-brand-cream)",
              }}
            >
              {SECTION_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-[220px_1fr] gap-6 px-4">
        {/* Section list (sidebar) */}
        <div className="space-y-1">
          {sections.map((s, i) => (
            <div key={i} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveSection(i)}
                className="flex-1 rounded-lg px-3 py-2 text-left font-[family-name:var(--font-body)] text-[13px] transition-colors"
                style={{
                  backgroundColor:
                    activeSection === i
                      ? "var(--color-brand-red)"
                      : "transparent",
                  color:
                    activeSection === i
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                }}
              >
                <span className="mr-1.5 text-[10px] opacity-50">
                  {i + 1}.
                </span>
                {SECTION_TYPE_LABELS[s.type]}
              </button>
              <div className="flex opacity-0 group-hover:opacity-100">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMoveSection(i, i - 1)}
                    className="px-1 text-[10px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
                    title="Move up"
                  >
                    ↑
                  </button>
                )}
                {i < sections.length - 1 && (
                  <button
                    type="button"
                    onClick={() => handleMoveSection(i, i + 1)}
                    className="px-1 text-[10px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
                    title="Move down"
                  >
                    ↓
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveSection(i)}
                  className="px-1 text-[10px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-red)]"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section editor */}
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--color-neutral-800)",
            border: "1px solid rgba(253,245,230,0.08)",
          }}
        >
          {currentSection && (
            <SectionEditor
              section={currentSection}
              onChange={(updated) => updateSection(activeSection, updated)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generic section editor                                              */
/* ------------------------------------------------------------------ */

function SectionEditor({
  section,
  onChange,
}: {
  section: ProposalSection;
  onChange: (s: ProposalSection) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1.5px" }}>
        {SECTION_TYPE_LABELS[section.type]}
      </div>
      <GenericFieldEditor section={section} onChange={onChange} />
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <div>
      <label
        className="mb-1 block font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </label>
      <Tag
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        {...(multiline ? { rows: 4 } : {})}
        className="w-full rounded-md border px-3 py-2 font-[family-name:var(--font-body)] text-[13px] leading-relaxed outline-none"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          color: "var(--color-brand-cream)",
          borderColor: "rgba(253,245,230,0.08)",
          resize: multiline ? "vertical" : undefined,
        }}
      />
    </div>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="mb-1 block font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="flex-1 rounded-md border px-3 py-1.5 font-[family-name:var(--font-body)] text-[13px] outline-none"
              style={{
                backgroundColor: "var(--color-neutral-900)",
                color: "var(--color-brand-cream)",
                borderColor: "rgba(253,245,230,0.08)",
              }}
            />
            <button
              type="button"
              onClick={() => {
                const next = items.filter((_, j) => j !== i);
                onChange(next.length ? next : [""]);
              }}
              className="text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-red)]"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]"
        >
          + Add item
        </button>
      </div>
    </div>
  );
}

function GenericFieldEditor({
  section,
  onChange,
}: {
  section: ProposalSection;
  onChange: (s: ProposalSection) => void;
}) {
  const d = section.data as Record<string, unknown>;

  function set(key: string, value: unknown) {
    onChange({ ...section, data: { ...d, [key]: value } } as ProposalSection);
  }

  switch (section.type) {
    case "cover":
      return (
        <div className="space-y-3">
          <FieldInput label="Title" value={section.data.title} onChange={(v) => set("title", v)} />
          <FieldInput label="Subtitle" value={section.data.subtitle} onChange={(v) => set("subtitle", v)} />
          {section.data.details.map((det, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr] gap-2">
              <FieldInput
                label={`Detail ${i + 1} label`}
                value={det.label}
                onChange={(v) => {
                  const next = [...section.data.details];
                  next[i] = { ...det, label: v };
                  set("details", next);
                }}
              />
              <FieldInput
                label={`Detail ${i + 1} value`}
                value={det.value}
                onChange={(v) => {
                  const next = [...section.data.details];
                  next[i] = { ...det, value: v };
                  set("details", next);
                }}
              />
            </div>
          ))}
          <FieldInput label="Prepared by" value={section.data.prepared_by} onChange={(v) => set("prepared_by", v)} />
          <FieldInput label="Date" value={section.data.date} onChange={(v) => set("date", v)} />
          <FieldInput label="Confidentiality line" value={section.data.confidentiality_line ?? ""} onChange={(v) => set("confidentiality_line", v)} placeholder="e.g. CONFIDENTIAL · PREPARED EXCLUSIVELY FOR…" />
        </div>
      );

    case "opportunity":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading} onChange={(v) => set("subheading", v)} />
          {section.data.stats.map((stat, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <FieldInput label={`Stat ${i + 1} value`} value={stat.value} onChange={(v) => { const next = [...section.data.stats]; next[i] = { ...stat, value: v }; set("stats", next); }} placeholder="e.g. $2.3B" />
              <FieldInput label={`Stat ${i + 1} label`} value={stat.label} onChange={(v) => { const next = [...section.data.stats]; next[i] = { ...stat, label: v }; set("stats", next); }} placeholder="e.g. Australian market (2025)" />
            </div>
          ))}
          <FieldInput label="Problem heading" value={section.data.problem_heading} onChange={(v) => set("problem_heading", v)} />
          <FieldInput label="Problem body" value={section.data.problem_body} onChange={(v) => set("problem_body", v)} multiline />
          <FieldInput label="Insight heading" value={section.data.insight_heading} onChange={(v) => set("insight_heading", v)} />
          <FieldInput label="Insight body" value={section.data.insight_body} onChange={(v) => set("insight_body", v)} multiline />
          <FieldInput label="Pull quote" value={section.data.pull_quote} onChange={(v) => set("pull_quote", v)} multiline />
        </div>
      );

    case "concept":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading} onChange={(v) => set("subheading", v)} />
          <FieldInput label="Concept title" value={section.data.concept_title} onChange={(v) => set("concept_title", v)} />
          <FieldInput label="Concept description" value={section.data.concept_description} onChange={(v) => set("concept_description", v)} multiline />
          <ListEditor label="What it is" items={section.data.what_it_is} onChange={(v) => set("what_it_is", v)} />
          <ListEditor label="What it isn't" items={section.data.what_it_isnt} onChange={(v) => set("what_it_isnt", v)} />
          <FieldInput label="Extras heading" value={section.data.extras_heading ?? ""} onChange={(v) => set("extras_heading", v)} />
          <FieldInput label="Extras body" value={section.data.extras_body ?? ""} onChange={(v) => set("extras_body", v)} multiline />
        </div>
      );

    case "ecosystem":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading} onChange={(v) => set("subheading", v)} />
          {section.data.layers.map((layer, i) => (
            <div key={i} className="rounded-md border p-3" style={{ borderColor: "rgba(253,245,230,0.08)" }}>
              <FieldInput label={`Layer ${i + 1} label`} value={layer.label} onChange={(v) => { const next = [...section.data.layers]; next[i] = { ...layer, label: v }; set("layers", next); }} />
              <div className="mt-2">
                <ListEditor label={`Layer ${i + 1} items`} items={layer.items} onChange={(items) => { const next = [...section.data.layers]; next[i] = { ...layer, items }; set("layers", next); }} />
              </div>
            </div>
          ))}
          <button type="button" onClick={() => set("layers", [...section.data.layers, { label: "", items: [""] }])} className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]">
            + Add layer
          </button>
          <FieldInput label="Footnote" value={section.data.footnote ?? ""} onChange={(v) => set("footnote", v)} />
        </div>
      );

    case "advantages":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading} onChange={(v) => set("subheading", v)} />
          {section.data.advantages.map((adv, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr] gap-2 rounded-md border p-3" style={{ borderColor: "rgba(253,245,230,0.08)" }}>
              <FieldInput label={`#${i + 1} Title`} value={adv.title} onChange={(v) => { const next = [...section.data.advantages]; next[i] = { ...adv, title: v }; set("advantages", next); }} />
              <FieldInput label="Body" value={adv.body} onChange={(v) => { const next = [...section.data.advantages]; next[i] = { ...adv, body: v }; set("advantages", next); }} multiline />
            </div>
          ))}
          <button type="button" onClick={() => set("advantages", [...section.data.advantages, { title: "", body: "" }])} className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]">
            + Add advantage
          </button>
        </div>
      );

    case "investment":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading} onChange={(v) => set("subheading", v)} />
          <FieldInput label="Intro paragraph" value={section.data.intro ?? ""} onChange={(v) => set("intro", v)} multiline />
          {section.data.options.map((opt, i) => (
            <div key={i} className="space-y-2 rounded-md border p-4" style={{ borderColor: opt.recommended ? "var(--color-brand-red)" : "rgba(253,245,230,0.08)" }}>
              <div className="flex items-center gap-3">
                <FieldInput label="Option name" value={opt.name} onChange={(v) => { const next = [...section.data.options]; next[i] = { ...opt, name: v }; set("options", next); }} />
                <label className="mt-4 flex items-center gap-1.5 whitespace-nowrap font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                  <input type="checkbox" checked={opt.recommended ?? false} onChange={(e) => { const next = [...section.data.options]; next[i] = { ...opt, recommended: e.target.checked }; set("options", next); }} />
                  Recommended
                </label>
              </div>
              <ListEditor label="Line items" items={opt.line_items} onChange={(items) => { const next = [...section.data.options]; next[i] = { ...opt, line_items: items }; set("options", next); }} />
              <div className="grid grid-cols-3 gap-2">
                <FieldInput label="Market value" value={opt.market_value ?? ""} onChange={(v) => { const next = [...section.data.options]; next[i] = { ...opt, market_value: v }; set("options", next); }} placeholder="e.g. ~$12,500" />
                <FieldInput label="Price" value={opt.price} onChange={(v) => { const next = [...section.data.options]; next[i] = { ...opt, price: v }; set("options", next); }} placeholder="e.g. $6,997" />
                <FieldInput label="Price suffix" value={opt.price_suffix ?? ""} onChange={(v) => { const next = [...section.data.options]; next[i] = { ...opt, price_suffix: v }; set("options", next); }} placeholder="e.g. +GST" />
              </div>
              {section.data.options.length > 1 && (
                <button type="button" onClick={() => { const next = section.data.options.filter((_, j) => j !== i); set("options", next); }} className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-brand-red)]">
                  Remove option
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => set("options", [...section.data.options, { name: "", line_items: [""], price: "" }])} className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]">
            + Add pricing option
          </button>
          <FieldInput label="Ad spend note" value={section.data.ad_spend_note ?? ""} onChange={(v) => set("ad_spend_note", v)} multiline placeholder="e.g. $2,000–$3,000/month (managed by client)" />
        </div>
      );

    case "next_steps":
      return (
        <div className="space-y-3">
          {section.data.steps.map((step, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr] gap-2">
              <FieldInput label={`Step ${i + 1} title`} value={step.title} onChange={(v) => { const next = [...section.data.steps]; next[i] = { ...step, title: v }; set("steps", next); }} />
              <FieldInput label="Description" value={step.description} onChange={(v) => { const next = [...section.data.steps]; next[i] = { ...step, description: v }; set("steps", next); }} />
            </div>
          ))}
          <button type="button" onClick={() => set("steps", [...section.data.steps, { title: "", description: "" }])} className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-brand-cream)]">
            + Add step
          </button>
          <FieldInput label="About heading" value={section.data.about_heading ?? ""} onChange={(v) => set("about_heading", v)} />
          <FieldInput label="About body" value={section.data.about_body ?? ""} onChange={(v) => set("about_body", v)} multiline />
          <FieldInput label="CTA line" value={section.data.cta_line ?? ""} onChange={(v) => set("cta_line", v)} placeholder="e.g. Ready to build your audience?" />
          <FieldInput label="CTA email" value={section.data.cta_email ?? ""} onChange={(v) => set("cta_email", v)} />
          <FieldInput label="CTA URL" value={section.data.cta_url ?? ""} onChange={(v) => set("cta_url", v)} />
        </div>
      );

    case "text_block":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading ?? ""} onChange={(v) => set("subheading", v)} />
          <FieldInput label="Body" value={section.data.body} onChange={(v) => set("body", v)} multiline />
        </div>
      );

    case "two_column":
      return (
        <div className="space-y-3">
          <FieldInput label="Heading" value={section.data.heading} onChange={(v) => set("heading", v)} />
          <FieldInput label="Subheading" value={section.data.subheading ?? ""} onChange={(v) => set("subheading", v)} />
          <FieldInput label="Left column heading" value={section.data.left_heading} onChange={(v) => set("left_heading", v)} />
          <ListEditor label="Left column items" items={section.data.left_items} onChange={(v) => set("left_items", v)} />
          <FieldInput label="Right column heading" value={section.data.right_heading} onChange={(v) => set("right_heading", v)} />
          <ListEditor label="Right column items" items={section.data.right_items} onChange={(v) => set("right_items", v)} />
        </div>
      );
  }
}
