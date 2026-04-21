"use client";

import Link from "next/link";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MAX_CHIPS = 6;

export function AttentionRail({ items }: { items: WaitingItem[] }) {
  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_CHIPS);
  const overflow = items.length - MAX_CHIPS;
  const showOverflow = overflow > 0;

  const chips = showOverflow ? visible.slice(0, MAX_CHIPS - 1) : visible;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
      {chips.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-[family-name:var(--font-body)] transition-colors"
          style={{
            backgroundColor: "var(--color-surface-1)",
            color: "var(--color-neutral-800)",
          }}
        >
          {item.scope === "fleet" && (
            <span
              className="mr-1 text-[11px]"
              style={{ color: "var(--color-neutral-500)" }}
            >
              [Fleet]
            </span>
          )}
          {item.label}
        </Link>
      ))}
      {showOverflow && (
        <Link
          href="/lite/cockpit/waiting"
          className="flex-shrink-0 rounded-full px-4 py-2 text-[13px] font-[family-name:var(--font-body)] transition-colors"
          style={{
            backgroundColor: "var(--color-surface-0)",
            color: "var(--color-neutral-500)",
          }}
        >
          +{overflow + 1} more
        </Link>
      )}
    </div>
  );
}
