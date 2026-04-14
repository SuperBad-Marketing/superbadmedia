"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { houseSpring } from "@/lib/design-tokens";
import {
  PaymentElementHost,
  type PaymentElementHostHandle,
} from "@/components/lite/quote-builder/quote-payment-element";
import type { InvoiceLineItem } from "@/lib/db/schema/invoices";

export type InvoiceStatusForClient = "sent" | "overdue" | "paid" | "void";

export type InvoicePayPhase = "idle" | "confirming" | "confirmed";

export type InvoiceWebExperienceProps = {
  token: string;
  invoiceNumber: string;
  status: InvoiceStatusForClient;
  companyName: string;
  companyAbn: string | null;
  contactLine: string | null;
  supplier: { name: string; abn: string; email: string };
  bank: { account_name: string; bsb: string; account_number: string };
  issueDateMs: number;
  dueDateMs: number;
  paidAtMs: number | null;
  stripePaymentIntentId: string | null;
  scopeSummary: string | null;
  lineItems: InvoiceLineItem[];
  gstApplicable: boolean;
  totalIncGstCents: number;
  totalExGstCents: number;
  gstCents: number;
  sourceQuoteToken: string | null;
  pdfHref: string;
};

function moneyAud(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function InvoiceWebExperience(props: InvoiceWebExperienceProps) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = React.useState<InvoicePayPhase>(
    props.status === "paid" ? "confirmed" : "idle",
  );
  const [paymentReady, setPaymentReady] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState(1);
  const sectionRefs = React.useRef<(HTMLElement | null)[]>([]);
  const payHandle = React.useRef<PaymentElementHostHandle | null>(null);

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = Number(
              (entry.target as HTMLElement).dataset.sectionIndex ?? 1,
            );
            setActiveSection(idx);
          }
        }
      },
      { threshold: 0.5 },
    );
    for (const el of sectionRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  async function onPay() {
    if (!payHandle.current || !paymentReady) return;
    setPhase("confirming");
    const result = await payHandle.current.confirm();
    if (!result.ok) {
      toast.error(result.message);
      setPhase("idle");
      return;
    }
    setPhase("confirmed");
  }

  const springTransition = reduced ? { duration: 0.02 } : houseSpring;
  const isOverdue = props.status === "overdue";

  return (
    <main
      className="relative min-h-[100dvh] overflow-y-scroll snap-y snap-mandatory"
      style={{
        backgroundColor: "var(--brand-cream, #faf6ef)",
        color: "var(--brand-charcoal, #1a1a1a)",
        fontFamily: "var(--font-dm-sans, system-ui)",
        scrollSnapType: "y mandatory",
        height: "100dvh",
      }}
    >
      <aside
        aria-hidden
        className="fixed left-4 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-3"
      >
        {[1, 2].map((i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-full transition-colors"
            style={{
              backgroundColor:
                activeSection === i
                  ? "var(--brand-red, #c1202d)"
                  : "color-mix(in srgb, var(--brand-charcoal) 20%, transparent)",
            }}
          />
        ))}
      </aside>

      {/* Section 1 — The Invoice */}
      <section
        ref={(el) => {
          sectionRefs.current[0] = el;
        }}
        data-section-index={1}
        className="min-h-[100dvh] snap-start flex items-start justify-center px-6 py-16 md:py-20"
      >
        <div className="w-full max-w-[760px]">
          <header className="flex items-start justify-between gap-6">
            <div>
              <div
                className="text-3xl leading-none tracking-wider"
                style={{ fontFamily: "var(--font-display, Impact)" }}
              >
                SUPERBAD
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#6b6b6b]">
                SuperBad Marketing · Melbourne
              </div>
            </div>
            {props.status === "paid" ? (
              <div
                className="rounded-sm border-2 px-3 py-1.5 text-lg tracking-wider"
                style={{
                  borderColor: "#2f8f5a",
                  color: "#2f8f5a",
                  fontFamily: "var(--font-display, Impact)",
                }}
              >
                PAID
              </div>
            ) : null}
          </header>

          <h1
            className="mt-10 text-2xl uppercase tracking-wide"
            style={{
              color: "var(--brand-red, #c1202d)",
              fontFamily: "var(--font-display, Impact)",
            }}
          >
            Tax Invoice
          </h1>

          <dl className="mt-5 grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-[#4a4a4a]">
            <div>
              <dt className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                Invoice
              </dt>
              <dd>{props.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                Issued
              </dt>
              <dd>{formatDate(props.issueDateMs)}</dd>
            </div>
            <div>
              <dt className="mb-1 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                Due
              </dt>
              <dd>{formatDate(props.dueDateMs)}</dd>
            </div>
          </dl>

          <section className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                Billed to
              </div>
              <div
                className="text-xl leading-tight"
                style={{ fontFamily: "var(--font-display, Impact)" }}
              >
                {props.companyName}
              </div>
              {props.companyAbn ? (
                <div className="mt-1 text-sm text-[#6b6b6b]">
                  ABN {props.companyAbn}
                </div>
              ) : null}
              {props.contactLine ? (
                <div className="text-sm text-[#6b6b6b]">{props.contactLine}</div>
              ) : null}
            </div>
            <div>
              <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                From
              </div>
              <div
                className="text-xl leading-tight"
                style={{ fontFamily: "var(--font-display, Impact)" }}
              >
                {props.supplier.name}
              </div>
              <div className="mt-1 text-sm text-[#6b6b6b]">
                ABN {props.supplier.abn}
              </div>
              <div className="text-sm text-[#6b6b6b]">{props.supplier.email}</div>
            </div>
          </section>

          {props.scopeSummary ? (
            <p
              className="mt-8 border-l-2 px-4 py-3 text-[15px] leading-relaxed text-[#4a4a4a]"
              style={{
                borderColor: "var(--brand-red, #c1202d)",
                backgroundColor:
                  "color-mix(in srgb, var(--brand-red, #c1202d) 5%, transparent)",
              }}
            >
              {props.scopeSummary}
            </p>
          ) : null}

          <table className="mt-10 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] text-[10px] uppercase tracking-[0.15em] text-[#6b6b6b]">
                <th className="py-2 text-left font-medium">Description</th>
                <th className="w-16 py-2 text-right font-medium">Qty</th>
                <th className="w-28 py-2 text-right font-medium">Unit inc GST</th>
                <th className="w-28 py-2 text-right font-medium">Line total</th>
              </tr>
            </thead>
            <tbody>
              {props.lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 italic text-[#8a8a8a]">
                    No line items.
                  </td>
                </tr>
              ) : (
                props.lineItems.map((l, i) => (
                  <tr key={i} className="border-b border-[#e6dfd1]">
                    <td className="py-3 align-top">{l.description}</td>
                    <td className="py-3 text-right align-top tabular-nums">
                      {l.quantity}
                    </td>
                    <td className="py-3 text-right align-top tabular-nums">
                      {moneyAud(l.unit_price_cents_inc_gst)}
                    </td>
                    <td className="py-3 text-right align-top tabular-nums">
                      {moneyAud(l.line_total_cents_inc_gst)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-6 ml-auto w-full max-w-[280px] text-sm">
            {props.gstApplicable ? (
              <>
                <div className="flex justify-between py-1 text-[#4a4a4a]">
                  <span>Subtotal (ex GST)</span>
                  <span className="tabular-nums">
                    {moneyAud(props.totalExGstCents)}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-[#4a4a4a]">
                  <span>GST (10%)</span>
                  <span className="tabular-nums">
                    {moneyAud(props.gstCents)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between py-1 text-xs italic text-[#8a8a8a]">
                <span>GST not applicable</span>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-[#1a1a1a] pt-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#6b6b6b]">
                Total inc GST
              </span>
              <span
                className="text-3xl leading-none tabular-nums"
                style={{ fontFamily: "var(--font-display, Impact)" }}
              >
                {moneyAud(props.totalIncGstCents)}
              </span>
            </div>
          </div>

          {props.sourceQuoteToken ? (
            <a
              href={`/lite/quotes/${props.sourceQuoteToken}`}
              className="mt-10 inline-flex items-center gap-2 text-sm text-[#4a4a4a] underline decoration-[#c1202d] underline-offset-4 hover:text-[#1a1a1a]"
            >
              View the original proposal →
            </a>
          ) : null}

          <div
            className="mt-16 text-center text-[10px] uppercase tracking-[0.24em] text-[#8a8a8a]"
            data-testid="scroll-hint"
          >
            ↓ payment below
          </div>
        </div>
      </section>

      {/* Section 2 — Payment */}
      <section
        ref={(el) => {
          sectionRefs.current[1] = el;
        }}
        data-section-index={2}
        className="min-h-[100dvh] snap-start flex items-center justify-center px-6 py-16 md:py-20"
      >
        <div className="w-full max-w-[640px]">
          {phase === "confirmed" ? (
            <PaidConfirmation
              invoiceNumber={props.invoiceNumber}
              paidAtMs={props.paidAtMs}
              stripePaymentIntentId={props.stripePaymentIntentId}
              pdfHref={props.pdfHref}
            />
          ) : (
            <>
              {isOverdue ? (
                <div
                  className="mb-6 rounded-sm border-l-2 px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--brand-red, #c1202d)",
                    color: "var(--brand-red, #c1202d)",
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-red, #c1202d) 5%, transparent)",
                  }}
                  data-testid="invoice-overdue-banner"
                >
                  This invoice is overdue.
                </div>
              ) : null}

              <h2
                className="text-2xl uppercase tracking-wide"
                style={{
                  color: "var(--brand-red, #c1202d)",
                  fontFamily: "var(--font-display, Impact)",
                }}
              >
                Payment
              </h2>

              <section className="mt-8">
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                  Bank transfer
                </div>
                <dl className="space-y-1 text-sm text-[#4a4a4a]">
                  <div className="flex justify-between">
                    <dt>Account name</dt>
                    <dd className="tabular-nums">{props.bank.account_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>BSB</dt>
                    <dd className="tabular-nums">{props.bank.bsb}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Account number</dt>
                    <dd className="tabular-nums">{props.bank.account_number}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Reference</dt>
                    <dd className="tabular-nums">{props.invoiceNumber}</dd>
                  </div>
                </dl>
              </section>

              <section className="mt-10">
                <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-[#8a8a8a]">
                  Or pay online
                </div>
                <motion.div
                  layoutId="quote-primary-action"
                  transition={springTransition}
                  className="rounded-lg p-6"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--brand-charcoal) 4%, transparent)",
                    border:
                      "1px solid color-mix(in srgb, var(--brand-charcoal) 12%, transparent)",
                  }}
                  data-testid="invoice-payment-element"
                >
                  <PaymentElementHost
                    token={props.token}
                    paymentIntentEndpoint={`/api/invoices/${props.token}/payment-intent`}
                    returnUrl={
                      typeof window === "undefined"
                        ? ""
                        : `${window.location.origin}/lite/invoices/${props.token}`
                    }
                    handleRef={payHandle}
                    onReady={() => setPaymentReady(true)}
                    onError={(m) => toast.error(m)}
                  />
                  <div className="mt-6 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={onPay}
                      disabled={!paymentReady || phase === "confirming"}
                      className="rounded-md px-6 py-3 text-base font-medium text-white"
                      style={{
                        backgroundColor: "var(--brand-red, #c1202d)",
                        opacity:
                          !paymentReady || phase === "confirming" ? 0.45 : 1,
                        cursor:
                          !paymentReady || phase === "confirming"
                            ? "not-allowed"
                            : "pointer",
                      }}
                      data-testid="invoice-pay-button"
                    >
                      {phase === "confirming"
                        ? "Processing…"
                        : `Pay ${moneyAud(props.totalIncGstCents)}`}
                    </button>
                  </div>
                </motion.div>
              </section>

              <footer className="mt-12 text-xs leading-relaxed text-[#8a8a8a]">
                {props.supplier.name}. ABN {props.supplier.abn}. Questions?
                Email{" "}
                <a
                  href={`mailto:${props.supplier.email}`}
                  className="underline"
                >
                  {props.supplier.email}
                </a>
                .
              </footer>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

function PaidConfirmation(props: {
  invoiceNumber: string;
  paidAtMs: number | null;
  stripePaymentIntentId: string | null;
  pdfHref: string;
}) {
  return (
    <motion.div
      layoutId="quote-primary-action"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg p-10 text-center"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--brand-charcoal) 4%, transparent)",
      }}
      data-testid="invoice-paid-confirmation"
    >
      <div
        className="inline-block rounded-sm border-2 px-3 py-1 text-lg tracking-wider"
        style={{
          borderColor: "#2f8f5a",
          color: "#2f8f5a",
          fontFamily: "var(--font-display, Impact)",
        }}
      >
        PAID
      </div>
      <h2
        className="mt-4 text-3xl"
        style={{ fontFamily: "var(--font-display, Impact)" }}
      >
        {props.invoiceNumber}
      </h2>
      <p
        className="mt-4 italic"
        style={{ fontFamily: "var(--font-narrative, serif)" }}
      >
        paid in full. pleasure doing business.
      </p>
      {props.stripePaymentIntentId ? (
        <p className="mt-6 text-xs text-[#8a8a8a]">
          Receipt reference: {props.stripePaymentIntentId}
        </p>
      ) : null}
      <a
        href={props.pdfHref}
        className="mt-8 inline-flex items-center gap-2 rounded-md px-5 py-3 text-white"
        style={{ backgroundColor: "var(--brand-charcoal, #1a1a1a)" }}
      >
        <span style={{ fontFamily: "var(--font-display, Impact)" }}>
          Download PDF
        </span>
        <span aria-hidden style={{ color: "var(--brand-red, #c1202d)" }}>
          →
        </span>
      </a>
    </motion.div>
  );
}
