"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { houseSpring } from "@/lib/design-tokens";
import { acceptQuoteAction } from "@/app/lite/quotes/[token]/actions";
import {
  PaymentElementHost,
  type PaymentElementHostHandle,
} from "./quote-payment-element";

/**
 * §5 Accept block — the only interactive zone on the client quote page.
 *
 * Phases:
 *   idle         — tickbox + Accept button (brand-red primary)
 *   payment      — Payment Element mounted (Stripe-billed only); Accept
 *                  button morphed via `layoutId="quote-primary-action"`
 *   confirming   — stripe.confirmPayment in flight
 *   confirmed    — Q16 confirmation screen (shared shell)
 *
 * Backdrop dim + blur is applied by the parent on phase !== "idle" via
 * a data attribute hook.
 */
export type AcceptPhase = "idle" | "payment" | "confirming" | "confirmed";

export type QuoteAcceptBlockProps = {
  token: string;
  paymentMode: "stripe" | "manual";
  quoteNumber: string;
  disabled?: boolean;
  /** Existing accepted state from server — skips the flow entirely. */
  alreadyAccepted?: boolean;
  /** Called with the current phase so the parent can dim surrounding sections. */
  onPhaseChange?: (p: AcceptPhase) => void;
};

export function QuoteAcceptBlock(props: QuoteAcceptBlockProps) {
  const [agreed, setAgreed] = React.useState(false);
  const [phase, setPhase] = React.useState<AcceptPhase>(
    props.alreadyAccepted ? "confirmed" : "idle",
  );
  const [pending, setPending] = React.useState(false);
  const [paymentReady, setPaymentReady] = React.useState(false);
  const payHandle = React.useRef<PaymentElementHostHandle | null>(null);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    props.onPhaseChange?.(phase);
  }, [phase, props]);

  async function onAccept() {
    if (!agreed || props.disabled) return;
    setPending(true);
    const res = await acceptQuoteAction({ token: props.token });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.paymentMode === "manual") {
      setPhase("confirmed");
      return;
    }
    // Stripe-billed: morph into Payment Element.
    setPhase("payment");
  }

  async function onPay() {
    if (!payHandle.current || !paymentReady) return;
    setPhase("confirming");
    const result = await payHandle.current.confirm();
    if (!result.ok) {
      toast.error(result.message);
      setPhase("payment");
      return;
    }
    setPhase("confirmed");
  }

  function onStepBack() {
    setPhase("idle");
    setAgreed(false);
    setPaymentReady(false);
  }

  if (phase === "confirmed") {
    return (
      <ConfirmationScreen
        paymentMode={props.paymentMode}
        quoteNumber={props.quoteNumber}
      />
    );
  }

  const acceptDisabled = props.disabled || !agreed || pending;
  const springTransition = reduced ? { duration: 0.02 } : houseSpring;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout" initial={false}>
        {phase === "idle" && (
          <motion.label
            key="tickbox"
            layout={!reduced}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.02 : 0.2 }}
            className="flex cursor-pointer items-start gap-3 text-base"
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={props.disabled}
              className="mt-1 h-5 w-5 cursor-pointer accent-[var(--brand-red)]"
            />
            <span>
              I agree to the{" "}
              <a
                href="/lite/legal/terms-of-service"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4"
                style={{ color: "var(--brand-red)" }}
              >
                terms of service
              </a>{" "}
              and{" "}
              <a
                href="/lite/legal/privacy-policy"
                target="_blank"
                rel="noopener"
                className="underline underline-offset-4"
                style={{ color: "var(--brand-red)" }}
              >
                privacy policy
              </a>
              .
            </span>
          </motion.label>
        )}
      </AnimatePresence>

      {phase === "idle" && (
        <motion.button
          layoutId="quote-primary-action"
          type="button"
          onClick={onAccept}
          disabled={acceptDisabled}
          transition={springTransition}
          className="rounded-md px-6 py-3 text-base font-medium text-white"
          style={{
            backgroundColor: "var(--brand-red)",
            opacity: acceptDisabled ? 0.45 : 1,
            cursor: acceptDisabled ? "not-allowed" : "pointer",
          }}
          data-testid="quote-accept-button"
        >
          {pending ? "Working…" : "Accept"}
        </motion.button>
      )}

      {(phase === "payment" || phase === "confirming") && (
        <motion.div
          layoutId="quote-primary-action"
          transition={springTransition}
          className="rounded-lg p-6"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand-charcoal) 4%, transparent)",
            border: "1px solid color-mix(in srgb, var(--brand-charcoal) 12%, transparent)",
          }}
          data-testid="quote-payment-element"
        >
          <PaymentElementHost
            token={props.token}
            returnUrl={`${typeof window === "undefined" ? "" : window.location.origin}/lite/quotes/${props.token}`}
            handleRef={payHandle}
            onReady={() => setPaymentReady(true)}
            onError={(m) => toast.error(m)}
          />
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={onStepBack}
              disabled={phase === "confirming"}
              className="text-sm underline underline-offset-4"
              style={{
                color: "color-mix(in srgb, var(--brand-charcoal) 65%, transparent)",
              }}
            >
              ← step back
            </button>
            <button
              type="button"
              onClick={onPay}
              disabled={!paymentReady || phase === "confirming"}
              className="rounded-md px-6 py-3 text-base font-medium text-white"
              style={{
                backgroundColor: "var(--brand-red)",
                opacity: !paymentReady || phase === "confirming" ? 0.45 : 1,
                cursor: !paymentReady || phase === "confirming" ? "not-allowed" : "pointer",
              }}
              data-testid="quote-pay-button"
            >
              {phase === "confirming" ? "Processing…" : "Pay now"}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ConfirmationScreen(props: {
  paymentMode: "stripe" | "manual";
  quoteNumber: string;
}) {
  return (
    <motion.div
      layoutId="quote-primary-action"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg p-8 text-center"
      style={{
        backgroundColor: "color-mix(in srgb, var(--brand-charcoal) 4%, transparent)",
      }}
      data-testid="quote-confirmation-screen"
    >
      <div
        className="text-[10px] uppercase tracking-[0.24em]"
        style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
      >
        {props.quoteNumber}
      </div>
      <h2
        className="mt-3 text-3xl"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {props.paymentMode === "stripe" ? "Payment received." : "Accepted."}
      </h2>
      <p
        className="mt-4 text-base italic"
        style={{ fontFamily: "var(--font-narrative)" }}
      >
        That&apos;s the hard bit done.
      </p>
      <p className="mt-6 text-base">
        {props.paymentMode === "stripe"
          ? "Receipt is coming from Stripe. Andy's got it from here."
          : "First invoice lands shortly. Andy's got it from here."}
      </p>
    </motion.div>
  );
}
