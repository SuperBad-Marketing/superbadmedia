"use client";

import * as React from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

/**
 * Payment Element host for QB-4c. Lazy-creates the Stripe instance once
 * and feeds it a clientSecret fetched from our PI route. The inner
 * `<PayForm />` runs `stripe.confirmPayment` when the parent signals it.
 */
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

export type PaymentElementHostHandle = {
  confirm: () => Promise<{ ok: true } | { ok: false; message: string }>;
};

export type PaymentElementHostProps = {
  token: string;
  returnUrl: string;
  /**
   * Override the PI endpoint. Defaults to the Quote Builder route.
   * BI-2b passes `/api/invoices/${token}/payment-intent` to reuse this
   * host for invoice payment without duplicating the Stripe glue.
   */
  paymentIntentEndpoint?: string;
  onReady?: () => void;
  onError?: (message: string) => void;
  handleRef: React.MutableRefObject<PaymentElementHostHandle | null>;
};

export function PaymentElementHost(props: PaymentElementHostProps) {
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const endpoint =
    props.paymentIntentEndpoint ?? `/api/quotes/${props.token}/payment-intent`;

  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `http_${res.status}`);
        }
        const body = await res.json();
        if (cancelled) return;
        setClientSecret(body.clientSecret);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) {
          setError(message);
          props.onError?.(message);
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  if (error) {
    return (
      <p
        className="text-sm italic"
        style={{ color: "var(--brand-red)", fontFamily: "var(--font-narrative)" }}
      >
        Couldn't set up payment — {error}. Reach Andy at andy@superbadmedia.com.au.
      </p>
    );
  }

  if (!clientSecret) {
    return (
      <p
        className="text-sm italic"
        style={{ color: "color-mix(in srgb, var(--brand-charcoal) 55%, transparent)" }}
      >
        Warming up the payment form…
      </p>
    );
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        appearance: { theme: "stripe", variables: { colorPrimary: "#cc2a2a" } },
      }}
    >
      <PayForm
        returnUrl={props.returnUrl}
        onReady={props.onReady}
        handleRef={props.handleRef}
      />
    </Elements>
  );
}

function PayForm(props: {
  returnUrl: string;
  onReady?: () => void;
  handleRef: React.MutableRefObject<PaymentElementHostHandle | null>;
}) {
  const stripe = useStripe();
  const elements = useElements();

  React.useEffect(() => {
    if (stripe && elements) props.onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripe, elements]);

  React.useEffect(() => {
    props.handleRef.current = {
      confirm: async () => {
        if (!stripe || !elements) {
          return { ok: false, message: "Payment form not ready" };
        }
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: props.returnUrl },
          redirect: "if_required",
        });
        if (result.error) {
          return {
            ok: false,
            message: result.error.message ?? "Payment failed",
          };
        }
        return { ok: true };
      },
    };
    return () => {
      props.handleRef.current = null;
    };
  }, [stripe, elements, props.handleRef, props.returnUrl]);

  return <PaymentElement options={{ layout: "tabs" }} />;
}
