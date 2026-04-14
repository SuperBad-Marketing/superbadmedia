"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
} from "@/components/ui/popover";
import { snoozeDealAction } from "@/app/lite/admin/pipeline/snooze-action";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatMelbourne(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    timeZone: "Australia/Melbourne",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function addDays(baseMs: number, days: number): number {
  return baseMs + days * DAY_MS;
}

/** YYYY-MM-DD for the native date input (browser-local interpretation). */
function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Snooze popover — presets at +1/+3/+7 days (default preset reads
 * `pipeline.snooze_default_days`) plus a custom date input. Commits via
 * `snoozeDealAction`; closes on success + fires a sonner success toast.
 *
 * Controls its own open-state; trigger is a styled button passed as
 * children-of-trigger via the standard Popover wiring.
 */
export function SnoozePopover({
  dealId,
  defaultDays,
  onSnoozed,
}: {
  dealId: string;
  defaultDays: number;
  /** Optimistic callback so the card can drop its halo immediately. */
  onSnoozed?: (untilMs: number) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [customDate, setCustomDate] = React.useState<string>(() =>
    toDateInputValue(addDays(Date.now(), defaultDays)),
  );

  const commit = React.useCallback(
    (untilMs: number) => {
      startTransition(async () => {
        const result = await snoozeDealAction(dealId, untilMs);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(`Snoozed until ${formatMelbourne(result.untilMs)}.`);
        onSnoozed?.(result.untilMs);
        setOpen(false);
        router.refresh();
      });
    },
    [dealId, onSnoozed, router],
  );

  const commitPreset = (days: number) => {
    commit(addDays(Date.now(), days));
  };

  const commitCustom = () => {
    // Native date input emits YYYY-MM-DD. Interpret at local midnight
    // then bump to the end-of-day so "today" isn't instantly expired.
    const [y, m, d] = customDate.split("-").map((v) => Number.parseInt(v, 10));
    if (!y || !m || !d) {
      toast.error("Pick a valid date.");
      return;
    }
    const untilMs = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
    commit(untilMs);
  };

  const presets = [
    { days: 1, label: "1 day" },
    { days: 3, label: "3 days" },
    { days: 7, label: "1 week" },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Snooze deal"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="rounded-sm border border-border/50 bg-background px-2 py-0.5 text-[10px] text-foreground/80 transition-colors hover:bg-muted"
          >
            Snooze
          </button>
        }
      />
      <PopoverContent
        align="start"
        side="bottom"
        className="w-60"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <PopoverHeader>
          <PopoverTitle>Snooze this deal</PopoverTitle>
        </PopoverHeader>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const isDefault = p.days === defaultDays;
            return (
              <button
                key={p.days}
                type="button"
                disabled={pending}
                onClick={() => commitPreset(p.days)}
                className="rounded-sm border border-border/60 bg-background px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {p.label}
                {isDefault ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    default
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customDate}
            min={toDateInputValue(addDays(Date.now(), 1))}
            onChange={(e) => setCustomDate(e.target.value)}
            disabled={pending}
            className="flex-1 rounded-sm border border-border/60 bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={pending}
            onClick={commitCustom}
            className="rounded-sm border border-border/60 bg-foreground px-2 py-1 text-xs text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Snooze
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
