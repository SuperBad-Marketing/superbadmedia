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
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0" }}>
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid var(--neutral-500)",
            borderTopColor: "var(--brand-red)",
            animation: "spin 1s linear infinite",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--neutral-500)",
          }}
        >
          Preparing payment&hellip;
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--brand-red)",
        }}
      >
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
          {/* Price display */}
          <div
            style={{
              textAlign: "center",
              marginBottom: 28,
              padding: "24px 32px",
              borderRadius: 16,
              background: "rgba(34,34,31,0.6)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(253,245,230,0.08)",
              boxShadow: "inset 0 1px 0 rgba(253,245,230,0.06)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.5rem, 6vw, 3.5rem)",
                lineHeight: 1,
                color: "var(--brand-cream)",
                margin: 0,
              }}
            >
              <sup
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--brand-pink)",
                  verticalAlign: "super",
                }}
              >
                $
              </sup>
              {(amountCents / 100).toFixed(0)}
            </p>
            <p
              style={{
                marginTop: 8,
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--neutral-500)",
              }}
            >
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
                  colorTextSecondary: "#8A8A80",
                  colorDanger: "#B22848",
                  borderRadius: "8px",
                  fontFamily: "var(--font-body), system-ui, sans-serif",
                  spacingUnit: "4px",
                },
                rules: {
                  ".Input": {
                    border: "1px solid rgba(253,245,230,0.08)",
                    boxShadow: "inset 0 1px 0 rgba(253,245,230,0.04)",
                    transition: "border-color 250ms cubic-bezier(0.16,1,0.3,1)",
                  },
                  ".Input:focus": {
                    border: "1px solid rgba(244,160,176,0.4)",
                    boxShadow: "inset 0 1px 0 rgba(253,245,230,0.04)",
                  },
                  ".Label": {
                    fontSize: "10px",
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "#8A8A80",
                  },
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

  const disabled = !stripe || processing || isPending;

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
        <p
          style={{
            marginTop: 12,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--brand-red)",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={disabled}
        style={{
          width: "100%",
          marginTop: 20,
          padding: "16px 24px",
          borderRadius: 10,
          border: "none",
          background: disabled ? "var(--neutral-700)" : "var(--brand-red)",
          color: "var(--brand-cream)",
          fontFamily: "var(--font-label)",
          fontSize: 12,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          boxShadow: disabled
            ? "none"
            : "0 8px 24px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)",
          transition:
            "transform 280ms cubic-bezier(0.2,0.8,0.2,1.05), box-shadow 280ms cubic-bezier(0.2,0.8,0.2,1.05), opacity 280ms ease",
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 12px 32px rgba(178,40,72,0.4), inset 0 1px 0 rgba(253,245,230,0.15)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          if (!disabled) {
            e.currentTarget.style.boxShadow =
              "0 8px 24px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)";
          }
        }}
      >
        {processing || isPending
          ? "Processing\u2026"
          : `Pay $${(amountCents / 100).toFixed(0)}`}
      </button>

      <p
        style={{
          marginTop: 16,
          textAlign: "center",
          fontFamily: "var(--font-body)",
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--neutral-500)",
        }}
      >
        Your shoot is locked in. After the day, we&rsquo;ll put your photos,
        video, and six-week plan together — you&rsquo;ll get everything at once,
        usually within a week.
      </p>
    </form>
  );
}
