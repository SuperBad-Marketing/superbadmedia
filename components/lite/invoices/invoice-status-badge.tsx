import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/db/schema/invoices";

const TONE: Record<InvoiceStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  sent: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  overdue: "bg-[#c1202d]/10 text-[#c1202d]",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  void: "bg-muted text-muted-foreground line-through decoration-from-font",
};

const LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE[status],
      )}
    >
      {LABEL[status]}
    </span>
  );
}
