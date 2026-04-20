"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  PlusIcon,
  FileTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  BanknoteIcon,
} from "lucide-react";
import { brand, neutral, semantic, houseSpring } from "@/lib/design-tokens";
import { submitInvoiceAction } from "@/app/bench/(authenticated)/actions";

interface Invoice {
  id: string;
  amount_aud: number;
  reference: string;
  notes: string | null;
  status: string;
  submitted_at_ms: number;
}

interface InvoicesSurfaceProps {
  invoices: Invoice[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; Icon: typeof ClockIcon }
> = {
  submitted: { label: "Submitted", color: neutral[500], Icon: ClockIcon },
  approved: { label: "Approved", color: brand.orange, Icon: CheckCircleIcon },
  paid: { label: "Paid", color: semantic.success, Icon: BanknoteIcon },
  rejected: { label: "Rejected", color: semantic.error, Icon: XCircleIcon },
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function InvoicesSurface({ invoices }: InvoicesSurfaceProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!reference.trim()) {
      setError("Invoice reference is required");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await submitInvoiceAction(
      Math.round(amountNum),
      reference,
      notes || undefined,
    );

    if (result.ok) {
      setShowForm(false);
      setAmount("");
      setReference("");
      setNotes("");
      router.refresh();
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={houseSpring}
          className="text-xl font-semibold tracking-tight"
          style={{ color: neutral[900] }}
        >
          Invoices
        </motion.h1>

        {!showForm && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={houseSpring}
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
            style={{ backgroundColor: brand.orange, color: "#fff" }}
          >
            <PlusIcon size={14} />
            New invoice
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={houseSpring}
            className="rounded-xl border p-4 space-y-3"
            style={{ borderColor: neutral[300] }}
          >
            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Amount (AUD)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: neutral[300],
                  color: neutral[900],
                  backgroundColor: "var(--color-surface-0)",
                }}
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Reference
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-001 or description"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: neutral[300],
                  color: neutral[900],
                  backgroundColor: "var(--color-surface-0)",
                }}
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details"
                rows={2}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                style={{
                  borderColor: neutral[300],
                  color: neutral[900],
                  backgroundColor: "var(--color-surface-0)",
                }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: semantic.error }}>
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                style={{ backgroundColor: brand.orange, color: "#fff" }}
              >
                {submitting ? "Submitting…" : "Submit invoice"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{ color: neutral[500] }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {invoices.length === 0 && !showForm ? (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: neutral[300] }}
        >
          <FileTextIcon
            size={24}
            className="mx-auto mb-2"
            style={{ color: neutral[500] }}
          />
          <p className="text-sm" style={{ color: neutral[500] }}>
            No invoices yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv, i) => {
            const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.submitted;
            const StatusIcon = cfg.Icon;
            return (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...houseSpring, delay: i * 0.03 }}
                className="flex items-center justify-between rounded-xl border p-4"
                style={{ borderColor: neutral[300] }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: neutral[900] }}
                  >
                    ${inv.amount_aud}
                  </p>
                  <p className="text-xs" style={{ color: neutral[500] }}>
                    {inv.reference} · {formatDate(inv.submitted_at_ms)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <StatusIcon size={14} style={{ color: cfg.color }} />
                  <span
                    className="text-xs font-medium"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
