"use client";

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

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function CataloguePicker(props: {
  catalogue: CatalogueItemView[];
  onPick: (item: CatalogueItemView, kind: "retainer" | "one_off") => void;
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
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            + From catalogue
          </button>
        }
      />
      <PopoverContent className="w-[380px] p-2" align="start">
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
        <div className="flex items-center gap-2 pb-2 text-xs">
          <span className="text-muted-foreground">Add as</span>
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
            <p className="py-4 text-center text-xs text-muted-foreground">
              {props.catalogue.length === 0
                ? "Catalogue is empty — add items in Settings (QB-2b)."
                : "No matches."}
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                props.onPick(c, kind);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <span className="flex flex-col min-w-0">
                <span className="truncate font-medium">{c.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {c.category} · {c.unit}
                </span>
              </span>
              <span className="font-mono text-xs">
                {formatMoney(c.base_price_cents_inc_gst)}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
