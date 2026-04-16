"use client";

/**
 * Quote editor — two-pane draft editor (§4.1).
 *
 * admin-polish-5 (Wave 9): visual rebuild against mockup-admin-interior.html.
 * §3 header now lives at page.tsx; this file owns the interior two-pane
 * chrome. §6 data-cards for sections, §7 table for line items, §8 earned
 * Send CTA, §9 BHS grand-total when status=accepted, layoutId device toggle.
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";

function randomUUID(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

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
  computeTotals,
  inferStructure,
  type QuoteContent,
  type QuoteLineItem,
} from "@/lib/quote-builder/content-shape";
import type { CatalogueItemUnit } from "@/lib/db/schema/catalogue-items";
import type { QuoteStatus } from "@/lib/db/schema/quotes";

import {
  updateDraftQuoteAction,
  redraftIntroParagraphAction,
  applyQuoteTemplateAction,
} from "@/app/lite/admin/deals/[id]/quotes/[quote_id]/edit/actions";
import { CataloguePicker, type CatalogueItemView } from "./catalogue-picker";
import { PreviewPane } from "./preview-pane";
import { SendQuoteModal } from "./send-quote-modal";

type BillingMode = "stripe" | "manual";

type EditorProps = {
  dealId: string;
  quoteId: string;
  quoteNumber: string;
  quoteStatus: QuoteStatus;
  billingMode: BillingMode;
  dealStage: string;
  company: { id: string; name: string; gst_applicable: boolean };
  primaryContact: { id: string; name: string } | null;
  initialContent: QuoteContent;
  catalogue: CatalogueItemView[];
  defaultExpiryDays: number;
  templates: Array<{
    id: string;
    name: string;
    structure: "retainer" | "project" | "mixed";
    term_length_months: number | null;
  }>;
};

const HOUSE_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

const EASE = "cubic-bezier(0.16,1,0.3,1)";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TERM_LENGTH_OPTIONS = [3, 6, 9, 12] as const;

export function QuoteEditor(props: EditorProps) {
  const [content, setContent] = useState<QuoteContent>(props.initialContent);
  const [expiryDays, setExpiryDays] = useState<number>(
    props.initialContent.expiry_days ?? props.defaultExpiryDays,
  );
  const [isSaving, startSave] = useTransition();
  const [isRedrafting, startRedraft] = useTransition();
  const [isApplying, startApply] = useTransition();
  const [redraftInstruction, setRedraftInstruction] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [sendOpen, setSendOpen] = useState(false);

  const totals = useMemo(() => computeTotals(content), [content]);
  const structure = useMemo(() => inferStructure(content), [content]);

  const locked =
    props.quoteStatus === "accepted" ||
    props.quoteStatus === "superseded" ||
    props.quoteStatus === "withdrawn";
  const acceptedMoment = props.quoteStatus === "accepted";

  function patchSection<K extends keyof QuoteContent["sections"]>(
    key: K,
    patch: Partial<QuoteContent["sections"][K]>,
  ) {
    setContent((prev) => ({
      ...prev,
      sections: { ...prev.sections, [key]: { ...prev.sections[key], ...patch } },
    }));
  }

  function setLineItems(next: QuoteLineItem[]) {
    patchSection("whatWellDo", { line_items: next });
  }

  function addCatalogueItem(
    item: CatalogueItemView,
    kind: "retainer" | "one_off",
  ) {
    const line: QuoteLineItem = {
      id: randomUUID(),
      kind,
      snapshot: {
        catalogue_item_id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        base_price_cents_inc_gst: item.base_price_cents_inc_gst,
        tier_rank: item.tier_rank,
      },
      qty: 1,
      unit_price_cents_inc_gst: item.base_price_cents_inc_gst,
    };
    setLineItems([...content.sections.whatWellDo.line_items, line]);
  }

  function addBlankItem(kind: "retainer" | "one_off") {
    const line: QuoteLineItem = {
      id: randomUUID(),
      kind,
      snapshot: {
        catalogue_item_id: null,
        name: "",
        category: "custom",
        unit: "project" as CatalogueItemUnit,
        base_price_cents_inc_gst: 0,
        tier_rank: null,
      },
      qty: 1,
      unit_price_cents_inc_gst: 0,
    };
    setLineItems([...content.sections.whatWellDo.line_items, line]);
  }

  function updateLineItem(id: string, patch: Partial<QuoteLineItem>) {
    setLineItems(
      content.sections.whatWellDo.line_items.map((l) =>
        l.id === id ? { ...l, ...patch } : l,
      ),
    );
  }

  function updateLineItemSnapshot(
    id: string,
    patch: Partial<QuoteLineItem["snapshot"]>,
  ) {
    setLineItems(
      content.sections.whatWellDo.line_items.map((l) =>
        l.id === id ? { ...l, snapshot: { ...l.snapshot, ...patch } } : l,
      ),
    );
  }

  function removeLineItem(id: string) {
    setLineItems(
      content.sections.whatWellDo.line_items.filter((l) => l.id !== id),
    );
  }

  function onRedraftIntro() {
    startRedraft(async () => {
      const res = await redraftIntroParagraphAction({
        quote_id: props.quoteId,
        freeformInstruction: redraftInstruction.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const v = res.value;
      if (!v.paragraph_text) {
        toast("No sources yet — write the first line by hand.");
        return;
      }
      patchSection("whatYouToldUs", {
        prose: v.paragraph_text,
        provenance: v.provenance,
        confidence: v.confidence,
      });
      toast.success(
        `Redrafted · ${v.confidence} confidence · ${v.remaining} left this hour`,
      );
      setRedraftInstruction("");
    });
  }

  function onApplyTemplate(templateId: string) {
    startApply(async () => {
      const res = await applyQuoteTemplateAction({
        quote_id: props.quoteId,
        template_id: templateId,
        current_content: content,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setContent(res.value.content);
      toast.success("Template applied.");
    });
  }

  function onSave() {
    const payload: QuoteContent = {
      ...content,
      expiry_days: expiryDays,
    };
    startSave(async () => {
      const res = await updateDraftQuoteAction({
        deal_id: props.dealId,
        quote_id: props.quoteId,
        content: payload,
      });
      if (res.ok) {
        toast.success("Draft saved.");
        setContent(payload);
      } else {
        toast.error(res.error);
      }
    });
  }

  const lineItems = content.sections.whatWellDo.line_items;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* LEFT PANE */}
      <section className="space-y-5">
        {/* §1 What you told us */}
        <DataCard>
          <SectionHeader num="01" title="What you told us" />
          <Textarea
            placeholder="Not enough context yet — write one line, or pull a thread from the discovery call."
            value={content.sections.whatYouToldUs.prose}
            onChange={(e) =>
              patchSection("whatYouToldUs", { prose: e.target.value })
            }
            disabled={locked}
            className="min-h-[120px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[color:var(--color-neutral-500)]">
            <span className="flex items-center gap-2">
              <span className="font-[family-name:var(--font-narrative)] italic">
                {content.sections.whatYouToldUs.provenance
                  ? `Drafted from: ${content.sections.whatYouToldUs.provenance}`
                  : "Hand-written"}
              </span>
              {content.sections.whatYouToldUs.confidence && (
                <ConfidencePill value={content.sections.whatYouToldUs.confidence} />
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Optional — e.g. make it shorter, reference the EOFY deadline"
              value={redraftInstruction}
              onChange={(e) => setRedraftInstruction(e.target.value)}
              disabled={locked}
              className="h-8 text-xs"
            />
            <GhostButton onClick={onRedraftIntro} disabled={isRedrafting || locked}>
              {isRedrafting ? "Redrafting…" : "Redraft"}
            </GhostButton>
          </div>
        </DataCard>

        {/* §2 What we'll do — line items table */}
        <DataCard>
          <SectionHeader num="02" title="What we'll do" />
          {lineItems.length === 0 ? (
            <EmptyRow
              headline="Nothing to quote yet."
              body="Pull from the catalogue, or drop in a blank row."
            />
          ) : (
            <div className="overflow-hidden rounded-[8px] border border-[rgba(253,245,230,0.05)]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th className="w-[80px]">Qty</Th>
                    <Th className="w-[120px]">Unit $</Th>
                    <Th className="w-[120px]">Kind</Th>
                    <Th className="w-[36px]" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <LineItemRow
                      key={item.id}
                      item={item}
                      locked={locked}
                      onChange={(patch) => updateLineItem(item.id, patch)}
                      onChangeSnapshot={(patch) =>
                        updateLineItemSnapshot(item.id, patch)
                      }
                      onRemove={() => removeLineItem(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CataloguePicker
              catalogue={props.catalogue}
              onPick={(item, kind) => addCatalogueItem(item, kind)}
              disabled={locked}
            />
            <GhostButton
              onClick={() => addBlankItem("one_off")}
              disabled={locked}
            >
              + Blank one-off
            </GhostButton>
            <GhostButton
              onClick={() => addBlankItem("retainer")}
              disabled={locked}
            >
              + Blank retainer
            </GhostButton>
          </div>
          <Textarea
            placeholder="Anything the list doesn't capture — sequencing, constraints, scope notes."
            value={content.sections.whatWellDo.prose}
            onChange={(e) =>
              patchSection("whatWellDo", { prose: e.target.value })
            }
            disabled={locked}
            className="mt-2 min-h-[80px]"
          />
        </DataCard>

        {/* §3 Price — grand total with accepted BHS moment */}
        <DataCard variant={acceptedMoment ? "won" : "default"}>
          <SectionHeader
            num="03"
            title="Price"
            eyebrowTone={acceptedMoment ? "success" : "orange"}
          />
          <dl className="space-y-1 text-[13px]">
            {totals.retainer_monthly_cents_inc_gst != null && (
              <div className="flex items-baseline justify-between">
                <dt className="text-[color:var(--color-neutral-400)]">
                  Retainer / month
                </dt>
                <dd
                  className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                  style={{ letterSpacing: "0.5px" }}
                >
                  {formatMoney(totals.retainer_monthly_cents_inc_gst)}
                </dd>
              </div>
            )}
            {totals.one_off_cents_inc_gst != null && (
              <div className="flex items-baseline justify-between">
                <dt className="text-[color:var(--color-neutral-400)]">
                  One-off total
                </dt>
                <dd
                  className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                  style={{ letterSpacing: "0.5px" }}
                >
                  {formatMoney(totals.one_off_cents_inc_gst)}
                </dd>
              </div>
            )}
            <div
              className="mt-2 flex items-baseline justify-between border-t pt-3"
              style={{ borderColor: "rgba(253,245,230,0.05)" }}
            >
              <dt
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                style={{ letterSpacing: "2px" }}
              >
                First invoice total
              </dt>
              {acceptedMoment ? (
                <dd
                  className="font-[family-name:var(--font-display)] tabular-nums text-[color:var(--color-brand-cream)]"
                  style={{
                    fontSize: "40px",
                    lineHeight: 1,
                    letterSpacing: "-0.4px",
                  }}
                >
                  {formatMoney(totals.total_cents_inc_gst)}
                </dd>
              ) : (
                <dd
                  className="font-[family-name:var(--font-label)] tabular-nums text-[color:var(--color-brand-cream)]"
                  style={{ letterSpacing: "0.8px", fontSize: "15px" }}
                >
                  {formatMoney(totals.total_cents_inc_gst)}
                </dd>
              )}
            </div>
          </dl>
          <p className="font-[family-name:var(--font-narrative)] text-[11px] italic text-[color:var(--color-neutral-500)]">
            All figures GST-inclusive
            {props.company.gst_applicable ? "" : " · company marked GST-free"}.
            {structure ? ` · ${structure}` : ""}
          </p>
        </DataCard>

        {/* §4 Terms */}
        <DataCard>
          <SectionHeader num="04" title="Terms" />
          <Textarea
            placeholder="Per-quote overrides. The default terms page covers the basics; drop anything special here."
            value={content.sections.terms.overrides_prose}
            onChange={(e) =>
              patchSection("terms", { overrides_prose: e.target.value })
            }
            disabled={locked}
            className="min-h-[80px]"
          />
        </DataCard>

        {/* §5 Accept — client-only preview */}
        <div
          className="rounded-[12px] p-[18px] text-[13px] text-[color:var(--color-neutral-500)]"
          style={{
            background: "rgba(15, 15, 14, 0.35)",
            border: "1px dashed rgba(253, 245, 230, 0.06)",
          }}
        >
          <SectionHeader num="05" title="Accept" eyebrowTone="muted" muted />
          <p className="mt-2 font-[family-name:var(--font-narrative)] italic">
            Shown to the client as a tickbox + Accept button. Not editable here.
          </p>
        </div>

        {/* Toolbar — controls + save/send */}
        <div
          className="flex flex-wrap items-end gap-3 rounded-[10px] p-[14px]"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
          }}
        >
          <ToolbarField label="Term length">
            <Select
              value={content.term_length_months?.toString() ?? "none"}
              onValueChange={(v) =>
                setContent((prev) => ({
                  ...prev,
                  term_length_months: v === "none" ? null : Number(v),
                }))
              }
              disabled={locked}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No commitment</SelectItem>
                {TERM_LENGTH_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m.toString()}>
                    {m} months
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ToolbarField>
          <ToolbarField label="Expiry (days)">
            <Input
              type="number"
              min={1}
              max={120}
              value={expiryDays}
              onChange={(e) =>
                setExpiryDays(Math.max(1, Number(e.target.value) || 1))
              }
              disabled={locked}
              className="h-9"
            />
          </ToolbarField>
          {props.templates.length > 0 && (
            <ToolbarField label="Apply template">
              <Select
                value=""
                onValueChange={(v) => v && onApplyTemplate(v)}
                disabled={isApplying || locked}
              >
                <SelectTrigger className="h-9">
                  <SelectValue
                    placeholder={isApplying ? "Applying…" : "Pick one"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {props.templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.structure}
                      {t.term_length_months ? ` · ${t.term_length_months}mo` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ToolbarField>
          )}
          <div className="ml-auto flex gap-2">
            <GhostButton onClick={onSave} disabled={isSaving || locked}>
              {isSaving ? "Saving…" : "Save draft"}
            </GhostButton>
            <PrimaryButton
              onClick={() => setSendOpen(true)}
              disabled={isSaving || locked || lineItems.length === 0}
            >
              Send
            </PrimaryButton>
          </div>
        </div>
      </section>

      <SendQuoteModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        dealId={props.dealId}
        quoteId={props.quoteId}
        preview={{
          status: "sent",
          quoteNumber: props.quoteNumber,
          companyName: props.company.name,
          primaryContactFirstName:
            props.primaryContact?.name?.split(/\s+/)[0] ?? null,
          content,
          termLengthMonths: content.term_length_months,
          retainerMonthlyCents: totals.retainer_monthly_cents_inc_gst,
          oneOffCents: totals.one_off_cents_inc_gst,
          totalCents: totals.total_cents_inc_gst,
          expiresAtMs: null,
        }}
      />

      {/* RIGHT PANE — preview */}
      <aside className="lg:sticky lg:top-4 h-fit space-y-3">
        <div className="flex items-center justify-between">
          <span
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Preview · {previewDevice}
          </span>
          <div
            role="tablist"
            aria-label="Preview device"
            className="inline-flex items-center gap-1 rounded-[8px] p-1"
            style={{
              background: "rgba(15, 15, 14, 0.45)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            {(["desktop", "mobile"] as const).map((d) => {
              const active = previewDevice === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPreviewDevice(d)}
                  className="relative rounded-[6px] px-3 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms]"
                  style={{
                    letterSpacing: "1.5px",
                    transitionTimingFunction: EASE,
                    color: active
                      ? "var(--color-brand-cream)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="quote-preview-device"
                      className="absolute inset-0 rounded-[6px]"
                      style={{
                        background: "var(--color-surface-2)",
                        boxShadow: "var(--surface-highlight)",
                      }}
                      transition={HOUSE_SPRING}
                    />
                  )}
                  <span className="relative">
                    {d === "desktop" ? "Desktop" : "Mobile"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <PreviewPane
          content={content}
          totals={totals}
          structure={structure}
          quoteNumber={props.quoteNumber}
          companyName={props.company.name}
          device={previewDevice}
        />
      </aside>
    </div>
  );
}

function DataCard({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "won";
}) {
  const style =
    variant === "won"
      ? {
          background:
            "linear-gradient(135deg, rgba(123,174,126,0.14), rgba(244,160,176,0.04) 60%, var(--color-surface-2) 95%)",
          border: "1px solid rgba(123, 174, 126, 0.28)",
          boxShadow: "var(--surface-highlight)",
        }
      : {
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid transparent",
        };
  return (
    <div
      className="flex flex-col gap-3 rounded-[12px] px-5 py-[18px]"
      style={style}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  num,
  title,
  muted = false,
  eyebrowTone = "orange",
}: {
  num: string;
  title: string;
  muted?: boolean;
  eyebrowTone?: "orange" | "success" | "muted";
}) {
  const eyebrowColor =
    eyebrowTone === "success"
      ? "var(--color-success)"
      : eyebrowTone === "muted"
      ? "var(--color-neutral-500)"
      : "var(--color-brand-orange)";
  return (
    <div className="flex items-baseline gap-3">
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
        style={{ letterSpacing: "2.5px", color: eyebrowColor }}
      >
        § {num}
      </span>
      <h2
        className="font-[family-name:var(--font-display)] text-[18px] leading-none"
        style={{
          letterSpacing: "-0.2px",
          color: muted
            ? "var(--color-neutral-400)"
            : "var(--color-brand-cream)",
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left font-[family-name:var(--font-label)] text-[10px] uppercase ${className ?? ""}`}
      style={{
        letterSpacing: "2px",
        color: "var(--color-neutral-500)",
        borderBottom: "1px solid rgba(253,245,230,0.05)",
        background: "rgba(15,15,14,0.25)",
      }}
    >
      {children}
    </th>
  );
}

function EmptyRow({
  headline,
  body,
}: {
  headline: string;
  body: string;
}) {
  return (
    <div
      className="rounded-[8px] px-4 py-5 text-center"
      style={{
        background: "rgba(15, 15, 14, 0.35)",
        border: "1px dashed rgba(253, 245, 230, 0.06)",
      }}
    >
      <div
        className="font-[family-name:var(--font-display)] text-[20px] text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        {headline}
      </div>
      <p className="mt-1 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
        {body}
      </p>
    </div>
  );
}

function ConfidencePill({ value }: { value: "low" | "medium" | "high" }) {
  const color =
    value === "low"
      ? "var(--color-warning)"
      : value === "high"
      ? "var(--color-success)"
      : "var(--color-brand-pink)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[2px] font-[family-name:var(--font-label)] text-[9px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        color,
        background: "rgba(253, 245, 230, 0.04)",
        border: "1px solid rgba(253, 245, 230, 0.05)",
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {value} confidence
    </span>
  );
}

function ToolbarField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[140px]">
      <label
        className="mb-1 block font-[family-name:var(--font-label)] text-[9px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none transition-colors duration-[180ms] disabled:opacity-50"
      style={{
        letterSpacing: "1.5px",
        padding: "8px 14px",
        borderRadius: "8px",
        background: "transparent",
        color: "var(--color-neutral-300)",
        border: "1px solid rgba(253, 245, 230, 0.10)",
        transitionTimingFunction: EASE,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.color = "var(--color-brand-cream)";
        e.currentTarget.style.borderColor = "rgba(244, 160, 176, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--color-neutral-300)";
        e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.10)";
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-[family-name:var(--font-label)] text-[11px] uppercase leading-none disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        letterSpacing: "1.8px",
        padding: "10px 18px",
        borderRadius: "8px",
        background: "var(--color-brand-red)",
        color: "var(--color-brand-cream)",
        border: "none",
        boxShadow:
          "inset 0 1px 0 rgba(253,245,230,0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
        transition: `transform 200ms ${EASE}`,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {children}
    </button>
  );
}

function LineItemRow(props: {
  item: QuoteLineItem;
  locked: boolean;
  onChange: (patch: Partial<QuoteLineItem>) => void;
  onChangeSnapshot: (patch: Partial<QuoteLineItem["snapshot"]>) => void;
  onRemove: () => void;
}) {
  const { item, locked } = props;
  return (
    <tr
      className="transition-colors duration-[160ms]"
      style={{
        transitionTimingFunction: EASE,
        borderBottom: "1px solid rgba(253,245,230,0.03)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(253, 245, 230, 0.025)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <td className="px-2 py-2 align-middle">
        <Input
          value={item.snapshot.name}
          placeholder="Item name"
          onChange={(e) => props.onChangeSnapshot({ name: e.target.value })}
          disabled={locked}
          className="h-8 border-transparent bg-transparent focus-visible:border-[rgba(244,160,176,0.25)]"
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <Input
          type="number"
          min={0}
          value={item.qty}
          onChange={(e) =>
            props.onChange({ qty: Math.max(0, Number(e.target.value) || 0) })
          }
          disabled={locked}
          className="h-8 border-transparent bg-transparent tabular-nums focus-visible:border-[rgba(244,160,176,0.25)]"
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <Input
          type="number"
          min={0}
          value={item.unit_price_cents_inc_gst / 100}
          step={0.01}
          onChange={(e) =>
            props.onChange({
              unit_price_cents_inc_gst: Math.max(
                0,
                Math.round((Number(e.target.value) || 0) * 100),
              ),
            })
          }
          disabled={locked}
          className="h-8 border-transparent bg-transparent tabular-nums focus-visible:border-[rgba(244,160,176,0.25)]"
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <Select
          value={item.kind}
          onValueChange={(v) =>
            props.onChange({ kind: v as "retainer" | "one_off" })
          }
          disabled={locked}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one_off">One-off</SelectItem>
            <SelectItem value="retainer">Retainer</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-2 align-middle text-right">
        <button
          type="button"
          onClick={props.onRemove}
          disabled={locked}
          aria-label="Remove line item"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--color-neutral-500)] transition-colors duration-[160ms] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40"
          style={{ transitionTimingFunction: EASE }}
        >
          ×
        </button>
      </td>
    </tr>
  );
}
