"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { houseSpring, motion as motionTokens } from "@/lib/design-tokens";
import {
  createPaymentIntentAction,
  confirmPaymentAction,
} from "./payment-actions";

const stripeRef: { current: Promise<StripeJs | null> | null } = {
  current: null,
};
function getStripePromise() {
  if (stripeRef.current) return stripeRef.current;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    stripeRef.current = Promise.resolve(null);
    return stripeRef.current;
  }
  stripeRef.current = loadStripe(key);
  return stripeRef.current;
}

interface PaymentPanelProps {
  token: string;
  submissionId: string;
}

export function PaymentPanel({ token, submissionId }: PaymentPanelProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(29700);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    createPaymentIntentAction({ submissionId }).then((result) => {
      setLoading(false);
      if (result.ok) {
        setClientSecret(result.clientSecret);
        setAmountCents(result.amountCents);
        setTimeout(() => setRevealed(true), 100);
      } else {
        setError(result.reason);
      }
    });
  }, [submissionId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-neutral-500)] border-t-[color:var(--color-brand-red)]" />
        <span className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          Preparing payment…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-red)]">
        {error}
      </p>
    );
  }

  if (!clientSecret) return null;

  return (
    <AnimatePresence>
      {revealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: motionTokens.tier2SlowMs / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="mb-4 text-center">
            <p className="font-[family-name:var(--font-display)] text-[2rem] text-[color:var(--color-brand-cream)]">
              ${(amountCents / 100).toFixed(0)}
            </p>
            <p className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
              GST inclusive
            </p>
          </div>

          <Elements
            stripe={getStripePromise()}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#B22848",
                  colorBackground: "#1A1A18",
                  colorText: "#FDF5E6",
                  borderRadius: "8px",
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                },
              },
            }}
          >
            <PaymentForm
              token={token}
              submissionId={submissionId}
              amountCents={amountCents}
            />
          </Elements>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PaymentForm({
  token,
  submissionId,
  amountCents,
}: {
  token: string;
  submissionId: string;
  amountCents: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed.");
      setProcessing(false);
      return;
    }

    const { paymentIntent, error: confirmError } =
      await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/lite/intro/${token}`,
        },
        redirect: "if_required",
      });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      startTransition(async () => {
        await confirmPaymentAction({
          submissionId,
          paymentIntentId: paymentIntent.id,
        });
        router.refresh();
      });
    } else {
      setError("Payment was not completed. Please try again.");
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />

      {error && (
        <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || processing || isPending}
        className="mt-4 w-full rounded-lg bg-[color:var(--color-brand-red)] px-6 py-3 font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)] transition hover:brightness-110 disabled:opacity-50"
      >
        {processing || isPending ? "Processing…" : `Pay $${(amountCents / 100).toFixed(0)}`}
      </button>

      <p className="mt-3 text-center font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        Your shoot is locked in. After the day, we&rsquo;ll put your photos,
        video, and six-week plan together — you&rsquo;ll get everything at once,
        usually within a week.
      </p>
    </form>
  );
}
