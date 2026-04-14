"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

function randomUUID(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

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
import { cn } from "@/lib/utils";
import {
  computeTotals,
  inferStructure,
  type QuoteContent,
  type QuoteLineItem,
} from "@/lib/quote-builder/content-shape";
import type { CatalogueItemUnit } from "@/lib/db/schema/catalogue-items";

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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      {/* LEFT PANE */}
      <section className="space-y-5">
        <header className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">{props.company.name}</h1>
              <p className="text-xs text-muted-foreground">
                {props.primaryContact?.name ?? "No primary contact"} ·{" "}
                <span className="capitalize">{props.dealStage}</span> ·{" "}
                {structure}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider",
                props.billingMode === "manual" && "border-amber-500/40",
              )}
            >
              {props.billingMode === "stripe" ? "Stripe-billed" : "Manual-billed"}
            </Badge>
          </div>
        </header>

        {/* §1 What you told us */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <SectionHeader num="1" title="What you told us" />
          <Textarea
            placeholder="Not enough context yet — write one line, or pull a thread from the discovery call."
            value={content.sections.whatYouToldUs.prose}
            onChange={(e) =>
              patchSection("whatYouToldUs", { prose: e.target.value })
            }
            className="min-h-[120px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              {content.sections.whatYouToldUs.provenance
                ? `Drafted from: ${content.sections.whatYouToldUs.provenance}`
                : "Hand-written"}
              {content.sections.whatYouToldUs.confidence && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase tracking-wider",
                    content.sections.whatYouToldUs.confidence === "low" &&
                      "border-amber-500/50 text-amber-600",
                  )}
                >
                  {content.sections.whatYouToldUs.confidence} confidence
                </Badge>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Optional — e.g. make it shorter, reference the EOFY deadline"
              value={redraftInstruction}
              onChange={(e) => setRedraftInstruction(e.target.value)}
              className="h-8 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onRedraftIntro}
              disabled={isRedrafting}
            >
              {isRedrafting ? "Redrafting…" : "Redraft"}
            </Button>
          </div>
        </div>

        {/* §2 What we'll do */}
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <SectionHeader num="2" title="What we'll do" />
          <div className="space-y-2">
            {content.sections.whatWellDo.line_items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No line items yet. Add from the catalogue, or add a blank row.
              </p>
            )}
            {content.sections.whatWellDo.line_items.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                onChange={(patch) => updateLineItem(item.id, patch)}
                onChangeSnapshot={(patch) =>
                  updateLineItemSnapshot(item.id, patch)
                }
                onRemove={() => removeLineItem(item.id)}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <CataloguePicker
              catalogue={props.catalogue}
              onPick={(item, kind) => addCatalogueItem(item, kind)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlankItem("one_off")}
            >
              + Blank one-off
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => addBlankItem("retainer")}
            >
              + Blank retainer
            </Button>
          </div>
          <Textarea
            placeholder="Anything the list doesn't capture — sequencing, constraints, scope notes."
            value={content.sections.whatWellDo.prose}
            onChange={(e) =>
              patchSection("whatWellDo", { prose: e.target.value })
            }
            className="mt-2 min-h-[80px]"
          />
        </div>

        {/* §3 Price */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <SectionHeader num="3" title="Price" />
          <dl className="space-y-1 text-sm">
            {totals.retainer_monthly_cents_inc_gst != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Retainer / month</dt>
                <dd className="font-medium">
                  {formatMoney(totals.retainer_monthly_cents_inc_gst)}
                </dd>
              </div>
            )}
            {totals.one_off_cents_inc_gst != null && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">One-off total</dt>
                <dd className="font-medium">
                  {formatMoney(totals.one_off_cents_inc_gst)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1">
              <dt className="font-semibold">First invoice total</dt>
              <dd className="font-semibold">
                {formatMoney(totals.total_cents_inc_gst)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            All figures GST-inclusive
            {props.company.gst_applicable ? "" : " · company marked GST-free"}.
          </p>
        </div>

        {/* §4 Terms */}
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <SectionHeader num="4" title="Terms" />
          <Textarea
            placeholder="Per-quote overrides. The default terms page covers the basics; drop anything special here."
            value={content.sections.terms.overrides_prose}
            onChange={(e) =>
              patchSection("terms", { overrides_prose: e.target.value })
            }
            className="min-h-[80px]"
          />
        </div>

        {/* §5 Accept (client-only) */}
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <SectionHeader num="5" title="Accept" muted />
          <p className="mt-1 text-xs">
            Shown to the client as a tickbox + Accept button. Not editable.
          </p>
        </div>

        {/* Sidebar controls — inlined below sections for mobile; QB-2b may
            lift these to a floating sidebar. */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Term length
            </label>
            <Select
              value={content.term_length_months?.toString() ?? "none"}
              onValueChange={(v) =>
                setContent((prev) => ({
                  ...prev,
                  term_length_months: v === "none" ? null : Number(v),
                }))
              }
            >
              <SelectTrigger>
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
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Expiry (days)
            </label>
            <Input
              type="number"
              min={1}
              max={120}
              value={expiryDays}
              onChange={(e) =>
                setExpiryDays(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </div>
          {props.templates.length > 0 && (
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Apply template
              </label>
              <Select
                value=""
                onValueChange={(v) => v && onApplyTemplate(v)}
                disabled={isApplying}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isApplying ? "Applying…" : "Pick one"} />
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
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save draft"}
            </Button>
            <Button
              onClick={() => setSendOpen(true)}
              disabled={
                isSaving ||
                content.sections.whatWellDo.line_items.length === 0
              }
              className="bg-[#c1202d] text-white hover:bg-[#a81a25]"
            >
              Send
            </Button>
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

      {/* RIGHT PANE — static preview for QB-2a; live/motion preview in QB-2b */}
      <aside className="lg:sticky lg:top-4 h-fit space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Preview · static
          </span>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={cn(
                "rounded-md px-2 py-1",
                previewDevice === "desktop"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Desktop
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={cn(
                "rounded-md px-2 py-1",
                previewDevice === "mobile"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mobile
            </button>
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

function SectionHeader(props: { num: string; title: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={cn(
          "font-mono text-xs",
          props.muted ? "text-muted-foreground" : "text-foreground/60",
        )}
      >
        §{props.num}
      </span>
      <h2 className="text-sm font-semibold">{props.title}</h2>
    </div>
  );
}

function LineItemRow(props: {
  item: QuoteLineItem;
  onChange: (patch: Partial<QuoteLineItem>) => void;
  onChangeSnapshot: (patch: Partial<QuoteLineItem["snapshot"]>) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  return (
    <div className="grid grid-cols-[1fr_80px_120px_auto_28px] items-center gap-2 rounded-md border border-border/60 bg-background/40 p-2">
      <Input
        value={item.snapshot.name}
        placeholder="Item name"
        onChange={(e) => props.onChangeSnapshot({ name: e.target.value })}
        className="h-8"
      />
      <Input
        type="number"
        min={0}
        value={item.qty}
        onChange={(e) =>
          props.onChange({ qty: Math.max(0, Number(e.target.value) || 0) })
        }
        className="h-8"
      />
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
        className="h-8"
      />
      <Select
        value={item.kind}
        onValueChange={(v) =>
          props.onChange({ kind: v as "retainer" | "one_off" })
        }
      >
        <SelectTrigger className="h-8 w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one_off">One-off</SelectItem>
          <SelectItem value="retainer">Retainer</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={props.onRemove}
        aria-label="Remove line item"
      >
        ×
      </Button>
    </div>
  );
}
