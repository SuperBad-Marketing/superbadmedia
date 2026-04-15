import type { InvoiceStatus } from "@/lib/db/schema/invoices";

/**
 * §5 status chip — Righteous 10px / 1.5px tracking, rgba-tinted, with dot.
 * Palette:
 *  - draft → neutral (in-progress)
 *  - sent → brand-pink (alive, awaiting)
 *  - overdue → brand-red + orange bleed (warm alert)
 *  - paid → success
 *  - void → neutral + strike
 */
const TONE: Record<InvoiceStatus, { bg: string; color: string }> = {
  draft: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
  sent: {
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  overdue: {
    bg: "rgba(178, 40, 72, 0.18)",
    color: "var(--color-brand-orange)",
  },
  paid: {
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  void: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
};

const LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const tone = TONE[status];
  const strike = status === "void";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
        textDecoration: strike ? "line-through" : undefined,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {LABEL[status]}
    </span>
  );
}
