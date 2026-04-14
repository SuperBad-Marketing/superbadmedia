"use client";

import * as React from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InvoiceDetail } from "@/lib/invoicing/detail-query";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import {
  addInvoiceLineItemAction,
  markInvoicePaidAction,
  removeInvoiceLineItemAction,
  sendInvoiceNowAction,
  sendReminderAction,
  supersedeInvoiceAction,
  updateInvoiceDueDateAction,
  voidInvoiceAction,
} from "@/app/lite/admin/invoices/actions";

interface Props {
  open: boolean;
  detail: InvoiceDetail | null;
  onClose: () => void;
}

function centsToDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function toInputDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function InvoiceDetailDrawer({ open, detail, onClose }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [paidOpen, setPaidOpen] = React.useState(false);
  const [voidOpen, setVoidOpen] = React.useState(false);

  async function run<T>(fn: () => Promise<T>, successMsg?: string) {
    setBusy(true);
    try {
      const result = await fn();
      if (successMsg) toast.success(successMsg);
      router.refresh();
      return result;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] overflow-y-auto">
        {!detail ? (
          <div className="p-8 text-sm text-muted-foreground">Loading invoice…</div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                <span className="font-mono text-base">
                  {detail.invoice.invoice_number}
                </span>
                <InvoiceStatusBadge status={detail.invoice.status} />
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {detail.company.name}
                {detail.contactName ? ` · ${detail.contactName}` : ""}
              </p>
            </SheetHeader>

            <div className="space-y-5 px-4 py-5">
              {detail.invoice.status === "overdue" && (
                <div className="rounded-md border border-[#c1202d]/30 bg-[#c1202d]/5 px-3 py-2 text-sm text-[#c1202d]">
                  This invoice is overdue.
                </div>
              )}

              {detail.invoice.status === "void" && detail.supersededByInvoice && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                  Superseded by{" "}
                  <button
                    onClick={() => {
                      const params = new URLSearchParams(window.location.search);
                      params.set("invoice", detail.supersededByInvoice!.id);
                      router.push(`?${params.toString()}`, { scroll: false });
                    }}
                    className="font-mono font-medium text-foreground underline"
                  >
                    {detail.supersededByInvoice.invoice_number}
                  </button>
                </div>
              )}

              <DateBlock
                issueMs={detail.invoice.issue_date_ms}
                dueMs={detail.invoice.due_at_ms}
                paidMs={detail.invoice.paid_at_ms}
                status={detail.invoice.status}
                invoiceId={detail.invoice.id}
                onDueUpdated={() => router.refresh()}
              />

              <LineItemsTable
                detail={detail}
                busy={busy}
                onChanged={() => router.refresh()}
              />

              <TotalsBlock detail={detail} />

              {detail.invoice.scope_summary && (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Scope summary
                  </div>
                  <div className="mt-1">{detail.invoice.scope_summary}</div>
                </div>
              )}

              {detail.sourceQuote && (
                <a
                  href={`/lite/quotes/${detail.sourceQuote.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground underline"
                >
                  View source quote ({detail.sourceQuote.quote_number}) →
                </a>
              )}

              <ActionMatrix
                detail={detail}
                busy={busy}
                onSendNow={() =>
                  run(
                    () =>
                      sendInvoiceNowAction({ invoiceId: detail.invoice.id }),
                    "Invoice sent.",
                  )
                }
                onOpenVoid={() => setVoidOpen(true)}
                onOpenReminder={() => setReminderOpen(true)}
                onOpenPaid={() => setPaidOpen(true)}
                onSupersede={async () => {
                  const result = await run(
                    () =>
                      supersedeInvoiceAction({
                        sourceInvoiceId: detail.invoice.id,
                      }),
                    "Replacement draft created.",
                  );
                  if (result?.ok) {
                    const params = new URLSearchParams(window.location.search);
                    params.set("invoice", result.newInvoiceId);
                    router.push(`?${params.toString()}`, { scroll: false });
                  }
                }}
              />
            </div>
          </>
        )}
      </SheetContent>

      {detail && (
        <>
          <ReminderModal
            open={reminderOpen}
            onOpenChange={setReminderOpen}
            detail={detail}
            onSent={() => {
              setReminderOpen(false);
              router.refresh();
            }}
          />
          <MarkPaidModal
            open={paidOpen}
            onOpenChange={setPaidOpen}
            detail={detail}
            onDone={() => {
              setPaidOpen(false);
              router.refresh();
            }}
          />
          <VoidModal
            open={voidOpen}
            onOpenChange={setVoidOpen}
            detail={detail}
            onDone={() => {
              setVoidOpen(false);
              router.refresh();
            }}
          />
        </>
      )}
    </Sheet>
  );
}

function ActionMatrix(props: {
  detail: InvoiceDetail;
  busy: boolean;
  onSendNow: () => void;
  onOpenVoid: () => void;
  onOpenReminder: () => void;
  onOpenPaid: () => void;
  onSupersede: () => void;
}) {
  const { detail, busy, onSendNow, onOpenVoid, onOpenReminder, onOpenPaid, onSupersede } = props;
  const s = detail.invoice.status;
  const pdfHref = `/api/invoices/${detail.invoice.token}/pdf`;
  const webHref = `/lite/invoices/${detail.invoice.token}`;

  return (
    <div className="flex flex-wrap gap-2">
      {s === "draft" && (
        <>
          <Button
            onClick={onSendNow}
            disabled={busy}
            className="bg-[#c1202d] text-white hover:bg-[#a81a25]"
          >
            Send now
          </Button>
          <Button variant="outline" disabled={busy} onClick={onOpenVoid}>
            Void
          </Button>
          <a href={pdfHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            Preview PDF
          </a>
          <a href={webHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            Preview web view
          </a>
        </>
      )}
      {(s === "sent" || s === "overdue") && (
        <>
          <Button
            onClick={onOpenPaid}
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Mark as paid
          </Button>
          <Button variant="outline" disabled={busy} onClick={onOpenReminder}>
            Send reminder
          </Button>
          <Button variant="outline" disabled={busy} onClick={onSupersede}>
            Edit (supersede)
          </Button>
          <Button variant="outline" disabled={busy} onClick={onOpenVoid}>
            Void
          </Button>
          <a href={pdfHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            View PDF
          </a>
          <a href={webHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            View web page
          </a>
        </>
      )}
      {s === "paid" && (
        <>
          <a href={pdfHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            View PDF
          </a>
          <a href={webHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
            View web page
          </a>
        </>
      )}
      {s === "void" && (
        <a href={pdfHref} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: "outline" }))}>
          View PDF
        </a>
      )}
    </div>
  );
}

function DateBlock(props: {
  issueMs: number;
  dueMs: number;
  paidMs: number | null;
  status: string;
  invoiceId: string;
  onDueUpdated: () => void;
}) {
  const { issueMs, dueMs, paidMs, status, invoiceId, onDueUpdated } = props;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(toInputDate(dueMs));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setValue(toInputDate(dueMs));
  }, [dueMs]);

  async function save() {
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return;
    const newDue = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    setSaving(true);
    const result = await updateInvoiceDueDateAction({
      invoiceId,
      dueAtMs: newDue,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEditing(false);
    onDueUpdated();
  }

  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Issued
        </div>
        <div>{fmtDate(issueMs)}</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Due
        </div>
        {status === "draft" && editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-[130px] px-2 py-0"
            />
            <Button size="sm" variant="ghost" onClick={save} disabled={saving}>
              Save
            </Button>
          </div>
        ) : status === "draft" ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="underline decoration-dotted"
          >
            {fmtDate(dueMs)}
          </button>
        ) : (
          <div>{fmtDate(dueMs)}</div>
        )}
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Paid
        </div>
        <div>{paidMs ? fmtDate(paidMs) : "—"}</div>
      </div>
    </div>
  );
}

function LineItemsTable(props: {
  detail: InvoiceDetail;
  busy: boolean;
  onChanged: () => void;
}) {
  const { detail, busy, onChanged } = props;
  const editable = detail.invoice.status === "draft";
  const [addOpen, setAddOpen] = React.useState(false);

  async function remove(index: number) {
    const result = await removeInvoiceLineItemAction({
      invoiceId: detail.invoice.id,
      index,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Line items
        </div>
        {editable && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
            disabled={busy}
          >
            Add line item
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit inc-GST</th>
              <th className="px-3 py-2 text-right">Line total</th>
              {editable && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {detail.lineItems.length === 0 && (
              <tr>
                <td
                  colSpan={editable ? 5 : 4}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No line items yet.
                </td>
              </tr>
            )}
            {detail.lineItems.map((li, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2">
                  {li.description}
                  {li.is_recurring && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (recurring)
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">{li.quantity}</td>
                <td className="px-3 py-2 text-right">
                  {centsToDollars(li.unit_price_cents_inc_gst)}
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {centsToDollars(li.line_total_cents_inc_gst)}
                </td>
                {editable && (
                  <td className="px-3 py-2 text-right">
                    {!li.is_recurring && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="text-xs text-muted-foreground hover:text-[#c1202d]"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddLineItemModal
        open={addOpen}
        onOpenChange={setAddOpen}
        invoiceId={detail.invoice.id}
        onAdded={() => {
          setAddOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

function TotalsBlock({ detail }: { detail: InvoiceDetail }) {
  const inv = detail.invoice;
  return (
    <div className="space-y-1 rounded-md border border-border p-3 text-sm">
      <Row
        label={inv.gst_applicable ? "Subtotal (ex-GST)" : "Subtotal"}
        value={centsToDollars(inv.total_cents_ex_gst)}
      />
      {inv.gst_applicable ? (
        <Row label="GST (10%)" value={centsToDollars(inv.gst_cents)} />
      ) : (
        <div className="text-xs text-muted-foreground">GST not applicable.</div>
      )}
      <Row
        label={<span className="font-semibold">Total inc-GST</span>}
        value={
          <span className="font-heading text-lg font-semibold">
            {centsToDollars(inv.total_cents_inc_gst)}
          </span>
        }
      />
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AddLineItemModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string;
  onAdded: () => void;
}) {
  const { open, onOpenChange, invoiceId, onAdded } = props;
  const [description, setDescription] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [unit, setUnit] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setDescription("");
      setQty("1");
      setUnit("");
    }
  }, [open]);

  async function submit() {
    const quantity = Math.max(1, Math.floor(Number(qty) || 0));
    const unitCents = Math.round((Number(unit) || 0) * 100);
    if (!description.trim() || unitCents < 0) return;
    setBusy(true);
    const result = await addInvoiceLineItemAction({
      invoiceId,
      lineItem: {
        description: description.trim(),
        quantity,
        unit_price_cents_inc_gst: unitCents,
      },
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Line item added.");
    onAdded();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add line item</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="li-desc">Description</Label>
            <Input
              id="li-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="li-qty">Quantity</Label>
              <Input
                id="li-qty"
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="li-unit">Unit price (inc-GST)</Label>
              <Input
                id="li-unit"
                type="number"
                step="0.01"
                min="0"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !description.trim()}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReminderModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: InvoiceDetail;
  onSent: () => void;
}) {
  const { open, onOpenChange, detail, onSent } = props;
  const [busy, setBusy] = React.useState(false);

  // Deterministic preview — mirrors composeInvoiceReminderEmail logic on the client
  // for the read-only preview. The actual send is server-side and re-runs the composer.
  const firstReminder = detail.invoice.reminder_count === 0;
  const subject = firstReminder
    ? `Quick one on ${detail.invoice.invoice_number}`
    : `Following up on ${detail.invoice.invoice_number}`;

  async function submit() {
    setBusy(true);
    const result = await sendReminderAction({ invoiceId: detail.invoice.id });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reminder sent.");
    onSent();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            To{" "}
            <span className="font-medium">
              {detail.contactName ?? "primary contact"}
            </span>
            {detail.contactEmail && (
              <span className="text-muted-foreground"> · {detail.contactEmail}</span>
            )}
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Subject
            </div>
            <div className="font-medium">{subject}</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deterministic reminder — Claude-drafted variant lands in BI-2b.
            Reminder #{detail.invoice.reminder_count + 1}.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || !detail.contactEmail}
            className="bg-[#c1202d] text-white hover:bg-[#a81a25]"
          >
            {busy ? "Sending…" : "Send reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: InvoiceDetail;
  onDone: () => void;
}) {
  const { open, onOpenChange, detail, onDone } = props;
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    const result = await markInvoicePaidAction({
      invoiceId: detail.invoice.id,
      paidVia: "bank_transfer",
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice marked as paid.");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as paid</DialogTitle>
        </DialogHeader>
        <p className="text-sm">
          Mark{" "}
          <span className="font-mono">{detail.invoice.invoice_number}</span> for{" "}
          <span className="font-semibold">
            {centsToDollars(detail.invoice.total_cents_inc_gst)}
          </span>{" "}
          from <span className="font-medium">{detail.company.name}</span> as
          paid via bank transfer?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy ? "Saving…" : "Mark paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidModal(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: InvoiceDetail;
  onDone: () => void;
}) {
  const { open, onOpenChange, detail, onDone } = props;
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    const result = await voidInvoiceAction({
      invoiceId: detail.invoice.id,
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Invoice voided.");
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p>
            Void{" "}
            <span className="font-mono">{detail.invoice.invoice_number}</span>?
            Any pending auto-send and overdue reminder tasks for this invoice
            will be cancelled. This cannot be undone.
          </p>
          <div className="space-y-1">
            <Label htmlFor="void-reason">Reason (optional)</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong amount"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} variant="destructive">
            {busy ? "Voiding…" : "Void invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { cn as _keepCnRefForLint }; // suppress unused import when stripped
