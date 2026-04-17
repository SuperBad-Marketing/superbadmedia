"use client";

/**
 * SB-9 — past_due recovery hero. Inline Stripe Payment Element mounted
 * on a SetupIntent client secret fetched via Server Action.
 *
 * State machine: idle → collecting → confirming → attached → done
 * (errors loop back to `collecting` with a dry inline line).
 *
 * On success: attaches the new payment method as the customer's default
 * via `attachDefaultPaymentMethodAction`, then shows "Card's on file.
 * Stripe'll retry within the hour." and auto-refreshes after 60s so the
 * dashboard re-reads `subscription_state` once Stripe dunning fires.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import {
  attachDefaultPaymentMethodAction,
  createSetupIntentAction,
} from "../actions-card-update";

const houseSpring = { type: "spring" as const, stiffness: 380, damping: 30 };

const globalStripeRef: { current: Promise<StripeJs | null> | null } = {
  current: null,
};

function getStripePromise(): Promise<StripeJs | null> {
  if (globalStripeRef.current) return globalStripeRef.current;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    globalStripeRef.current = Promise.resolve(null);
    return globalStripeRef.current;
  }
  globalStripeRef.current = loadStripe(key);
  return globalStripeRef.current;
}

type Phase = "loading" | "ready" | "confirming" | "attaching" | "done" | "error";

export function PastDueCardUpdateClient(props: { productName: string }) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>("loading");
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await createSetupIntentAction();
      if (cancelled) return;
      if (res.ok && res.clientSecret) {
        setClientSecret(res.clientSecret);
        setPhase("ready");
      } else {
        setPhase("error");
        setMessage(res.error ?? "Couldn't start a card update. Try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (phase !== "done") return;
    const t = window.setTimeout(() => {
      window.location.reload();
    }, 60_000);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <div className="flex flex-col gap-4" data-testid="past-due-card-update">
      <p className="text-foreground/80 text-base leading-relaxed">
        Stripe couldn&apos;t charge your card for {props.productName}. Pop a new one on file and
        Stripe&apos;ll retry within the hour.
      </p>
      <AnimatePresence mode="wait" initial={false}>
        {phase === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="text-foreground/60 text-sm"
            data-testid="past-due-loading"
          >
            Setting up…
          </motion.div>
        )}
        {phase === "error" && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="text-sm italic"
            style={{ color: "var(--brand-red)" }}
            data-testid="past-due-error"
          >
            {message}
          </motion.p>
        )}
        {(phase === "ready" || phase === "confirming" || phase === "attaching") &&
          clientSecret && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={houseSpring}
            >
              <Elements
                stripe={getStripePromise()}
                options={{ clientSecret, appearance: { theme: "stripe" } }}
              >
                <CardForm
                  phase={phase}
                  setPhase={setPhase}
                  setMessage={setMessage}
                />
              </Elements>
              {message && (
                <p
                  className="mt-3 text-sm italic"
                  style={{ color: "var(--brand-red)" }}
                  data-testid="past-due-inline-error"
                >
                  {message}
                </p>
              )}
            </motion.div>
          )}
        {phase === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={houseSpring}
            className="flex flex-col gap-2"
            data-testid="past-due-done"
          >
            <p className="text-foreground text-base font-semibold">
              Card&apos;s on file. Stripe&apos;ll retry within the hour.
            </p>
            <p className="text-foreground/60 text-sm">
              This page refreshes in a minute.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CardForm(props: {
  phase: Phase;
  setPhase: (p: Phase) => void;
  setMessage: (m: string | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const submitting = props.phase === "confirming" || props.phase === "attaching";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    props.setMessage(null);
    props.setPhase("confirming");

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      props.setPhase("ready");
      props.setMessage(error.message ?? "Card didn't save. Try again.");
      return;
    }

    const pmId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent?.payment_method?.id ?? null;

    if (!pmId) {
      props.setPhase("ready");
      props.setMessage("Stripe didn't return a payment method. Try again.");
      return;
    }

    props.setPhase("attaching");
    const attach = await attachDefaultPaymentMethodAction(pmId);
    if (!attach.ok) {
      props.setPhase("ready");
      props.setMessage(attach.error ?? "Couldn't set that card as default.");
      return;
    }
    props.setPhase("done");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <motion.button
        type="submit"
        whileHover={{ y: submitting ? 0 : -2 }}
        whileTap={{ scale: submitting ? 1 : 0.98 }}
        transition={houseSpring}
        disabled={!stripe || submitting}
        className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-60 rounded-md px-5 py-3 text-sm font-semibold"
        data-testid="past-due-submit"
      >
        {props.phase === "confirming"
          ? "Saving card…"
          : props.phase === "attaching"
            ? "Finishing up…"
            : "Save card"}
      </motion.button>
    </form>
  );
}
