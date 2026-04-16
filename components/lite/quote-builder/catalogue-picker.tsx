"use client";

/**
 * Catalogue picker — popover used by quote-editor §2.
 *
 * admin-polish-5 (Wave 9): §6 surface-2 popover chrome + Righteous-labelled
 * rows with rule-09 hover ease. Trigger matches the editor's §8 ghost
 * button recipe so it sits flush next to the Blank one-off / retainer
 * buttons.
 */

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogueItemUnit } from "@/lib/db/schema/catalogue-items";

export type CatalogueItemView = {
  id: string;
  name: string;
  category: string;
  unit: CatalogueItemUnit;
  base_price_cents_inc_gst: number;
  tier_rank: number | null;
  description: string | null;
};

const EASE = "cubic-bezier(0.16,1,0.3,1)";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function CataloguePicker(props: {
  catalogue: CatalogueItemView[];
  onPick: (item: CatalogueItemView, kind: "retainer" | "one_off") => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [kind, setKind] = useState<"retainer" | "one_off">("one_off");

  const categories = useMemo(() => {
    const set = new Set(props.catalogue.map((c) => c.category));
    return ["all", ...Array.from(set).sort()];
  }, [props.catalogue]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return props.catalogue.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.category.toLowerCase().includes(needle)
      );
    });
  }, [props.catalogue, q, category]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={props.disabled}
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
              if (props.disabled) return;
              e.currentTarget.style.color = "var(--color-brand-cream)";
              e.currentTarget.style.borderColor = "rgba(244, 160, 176, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--color-neutral-300)";
              e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.10)";
            }}
          >
            + From catalogue
          </button>
        }
      />
      <PopoverContent
        className="w-[380px] p-2"
        align="start"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          borderRadius: "12px",
          border: "1px solid rgba(253, 245, 230, 0.05)",
        }}
      >
        <div className="flex gap-2 pb-2">
          <Input
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8"
          />
          <Select
            value={category}
            onValueChange={(v) => setCategory(v ?? "all")}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div
          className="flex items-center gap-2 pb-2 font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{ letterSpacing: "1.5px" }}
        >
          <span className="text-[color:var(--color-neutral-500)]">Add as</span>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as "retainer" | "one_off")}
          >
            <SelectTrigger className="h-7 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one_off">One-off</SelectItem>
              <SelectItem value="retainer">Retainer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-[260px] overflow-y-auto">
          {filtered.length === 0 && (
            <div
              className="rounded-[8px] px-3 py-4 text-center"
              style={{
                background: "rgba(15, 15, 14, 0.35)",
                border: "1px dashed rgba(253, 245, 230, 0.06)",
              }}
            >
              <p className="font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
                {props.catalogue.length === 0
                  ? "Nothing in the catalogue yet."
                  : "No matches."}
              </p>
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                props.onPick(c, kind);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors duration-[160ms]"
              style={{ transitionTimingFunction: EASE }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(253, 245, 230, 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] text-[color:var(--color-brand-cream)]">
                  {c.name}
                </span>
                <span
                  className="truncate font-[family-name:var(--font-label)] text-[9px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  {c.category} · {c.unit}
                </span>
              </span>
              <span
                className="font-[family-name:var(--font-label)] text-[12px] tabular-nums text-[color:var(--color-brand-cream)]"
                style={{ letterSpacing: "1px" }}
              >
                {formatMoney(c.base_price_cents_inc_gst)}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
