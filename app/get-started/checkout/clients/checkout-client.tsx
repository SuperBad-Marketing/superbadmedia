"use client";

/**
 * Checkout client — two-phase conversion surface.
 *
 * Phase 1 (voice visible): identity block (email + business name) + three
 * commitment radio cards + "Continue to payment".
 *
 * Phase 2 (voice suppressed per spec §3.3): Stripe Payment Element +
 * "Pay and get going". On success we redirect to `/get-started/welcome`.
 *
 * The commitment + identity remain editable only in Phase 1. Once the
 * Stripe subscription is created (Phase 2), commitment changes would
 * require cancelling the draft subscription — out of scope for this
 * slice. We keep the commitment visible as a confirmation line instead.
 *
 * Owner: SB-5.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";

import {
  CHECKOUT_COMMITMENT_ORDER,
  CHECKOUT_CONTINUE_COPY,
  CHECKOUT_ERROR_COPY,
  CHECKOUT_IDENTITY_COPY,
  CHECKOUT_ISSUES_COPY,
  CHECKOUT_SECOND_PRODUCT_NUDGE,
  CHECKOUT_TOTAL_COPY,
  COMMITMENT_COPY,
  type CommitmentCadence,
} from "@/lib/content/checkout-page";
import { formatCentsAud } from "@/lib/saas-products/pricing-page-view-model";
import { createSaasSubscriptionAction } from "../actions";

type Props = {
  productId: string;
  productSlug: string;
  tierId: string;
  tierName: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
  /** Authenticated subscriber with an existing saas deal + full-suite product exists. Null = hide nudge. */
  fullSuiteMonthlyCents: number | null;
};

const stripePromiseRef: { current: Promise<StripeJs | null> | null } = {
  current: null,
};

function getStripePromise(): Promise<StripeJs | null> {
  if (stripePromiseRef.current) return stripePromiseRef.current;
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    stripePromiseRef.current = Promise.resolve(null);
    return stripePromiseRef.current;
  }
  stripePromiseRef.current = loadStripe(key);
  return stripePromiseRef.current;
}

function todayChargeCents(
  cadence: CommitmentCadence,
  monthlyCents: number,
  setupFeeCents: number,
): number {
  if (cadence === "monthly") return monthlyCents + setupFeeCents;
  if (cadence === "annual_monthly") return monthlyCents;
  return monthlyCents * 12;
}

const houseSpring = { type: "spring", stiffness: 420, damping: 34 } as const;

export function CheckoutClient(props: Props) {
  const [cadence, setCadence] = React.useState<CommitmentCadence>("monthly");
  const [email, setEmail] = React.useState("");
  const [businessName, setBusinessName] = React.useState("");
  const [phase, setPhase] = React.useState<"details" | "payment">("details");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  const totalCents = todayChargeCents(
    cadence,
    props.monthlyPriceCents,
    props.setupFeeCents,
  );

  const handleContinue = React.useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const result = await createSaasSubscriptionAction({
        tierId: props.tierId,
        productSlug: props.productSlug,
        cadence,
        email,
        businessName,
      });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setClientSecret(result.clientSecret);
      setPhase("payment");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [props.tierId, props.productSlug, cadence, email, businessName]);

  const detailsValid =
    email.trim().length > 3 &&
    /^\S+@\S+\.\S+$/.test(email) &&
    businessName.trim().length > 0;

  return (
    <div className="flex flex-col gap-8" data-testid="checkout-client">
      {phase === "details" ? (
        <>
          <IdentityBlock
            email={email}
            onEmail={setEmail}
            businessName={businessName}
            onBusinessName={setBusinessName}
          />

          <CommitmentRadios
            selected={cadence}
            onSelect={setCadence}
            monthlyPriceCents={props.monthlyPriceCents}
            setupFeeCents={props.setupFeeCents}
          />

          <TotalLine
            cadence={cadence}
            totalCents={totalCents}
            setupFeeCents={props.setupFeeCents}
          />

          {props.fullSuiteMonthlyCents !== null ? (
            <p
              className="text-foreground/60 text-sm italic"
              data-testid="full-suite-nudge"
            >
              {CHECKOUT_SECOND_PRODUCT_NUDGE.leadIn}{" "}
              <a
                href={CHECKOUT_SECOND_PRODUCT_NUDGE.href}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {CHECKOUT_SECOND_PRODUCT_NUDGE.template(
                  formatCentsAud(props.fullSuiteMonthlyCents),
                )}
              </a>
            </p>
          ) : null}

          {error ? <ErrorSurface message={error} /> : null}

          <button
            type="button"
            disabled={!detailsValid || submitting}
            onClick={handleContinue}
            data-testid="checkout-continue-button"
            className="bg-primary text-primary-foreground mt-2 inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-transform hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? CHECKOUT_CONTINUE_COPY.continueProcessingLabel
              : CHECKOUT_CONTINUE_COPY.continueLabel}
          </button>
        </>
      ) : (
        <PaymentPhase
          clientSecret={clientSecret}
          cadence={cadence}
          totalCents={totalCents}
          setupFeeCents={props.setupFeeCents}
          email={email}
        />
      )}

      <p className="text-foreground/50 text-xs" data-testid="checkout-issues-line">
        {CHECKOUT_ISSUES_COPY.prefix}
        <a
          href={`mailto:${CHECKOUT_ISSUES_COPY.email}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {CHECKOUT_ISSUES_COPY.email}
        </a>
      </p>
    </div>
  );
}

function IdentityBlock(props: {
  email: string;
  onEmail: (v: string) => void;
  businessName: string;
  onBusinessName: (v: string) => void;
}) {
  return (
    <section
      aria-labelledby="checkout-identity-heading"
      className="flex flex-col gap-4"
      data-testid="checkout-identity"
    >
      <h2
        id="checkout-identity-heading"
        className="font-heading text-lg font-semibold"
      >
        {CHECKOUT_IDENTITY_COPY.heading}
      </h2>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {CHECKOUT_IDENTITY_COPY.emailLabel}
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={props.email}
          onChange={(e) => props.onEmail(e.target.value)}
          className="border-border focus:ring-primary bg-background rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          data-testid="checkout-email-input"
        />
        <span className="text-foreground/50 text-xs">
          {CHECKOUT_IDENTITY_COPY.emailHint}
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          {CHECKOUT_IDENTITY_COPY.businessNameLabel}
        </span>
        <input
          type="text"
          autoComplete="organization"
          value={props.businessName}
          onChange={(e) => props.onBusinessName(e.target.value)}
          className="border-border focus:ring-primary bg-background rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          data-testid="checkout-business-name-input"
        />
        <span className="text-foreground/50 text-xs">
          {CHECKOUT_IDENTITY_COPY.businessNameHint}
        </span>
      </label>
    </section>
  );
}

function CommitmentRadios(props: {
  selected: CommitmentCadence;
  onSelect: (c: CommitmentCadence) => void;
  monthlyPriceCents: number;
  setupFeeCents: number;
}) {
  return (
    <fieldset
      className="flex flex-col gap-3"
      data-testid="checkout-commitment-radios"
    >
      <legend className="sr-only">Commitment</legend>
      {CHECKOUT_COMMITMENT_ORDER.map((cadence) => (
        <CommitmentCard
          key={cadence}
          cadence={cadence}
          selected={props.selected === cadence}
          onSelect={() => props.onSelect(cadence)}
          monthlyPriceCents={props.monthlyPriceCents}
          setupFeeCents={props.setupFeeCents}
        />
      ))}
    </fieldset>
  );
}

function CommitmentCard(props: {
  cadence: CommitmentCadence;
  selected: boolean;
  onSelect: () => void;
  monthlyPriceCents: number;
  setupFeeCents: number;
}) {
  const copy = COMMITMENT_COPY[props.cadence];
  const monthly = formatCentsAud(props.monthlyPriceCents);
  const priceLine =
    props.cadence === "monthly"
      ? `$${monthly}${CHECKOUT_TOTAL_COPY.perMonthSuffix}${props.setupFeeCents > 0 ? ` + $${formatCentsAud(props.setupFeeCents)} setup` : ""}`
      : props.cadence === "annual_monthly"
        ? `$${monthly}${CHECKOUT_TOTAL_COPY.perMonthSuffix} · 12-month commitment`
        : `$${formatCentsAud(props.monthlyPriceCents * 12)} today · covers 12 months`;

  return (
    <motion.label
      animate={{
        scale: props.selected ? 1 : 1,
        borderColor: props.selected
          ? "var(--color-primary)"
          : "var(--color-border)",
      }}
      transition={houseSpring}
      className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border p-4 ${
        props.selected ? "bg-muted/30" : "bg-card"
      }`}
      data-testid={`commitment-card-${props.cadence}`}
      data-selected={props.selected ? "true" : "false"}
    >
      <input
        type="radio"
        name="commitment"
        value={props.cadence}
        checked={props.selected}
        onChange={props.onSelect}
        className="sr-only"
      />
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-foreground/50 text-[10px] uppercase tracking-[0.22em]">
            {copy.eyebrow}
          </p>
          <p className="font-heading text-base font-semibold">{copy.headline}</p>
        </div>
        <p className="font-heading text-sm font-medium">{priceLine}</p>
      </div>
      <p className="text-foreground/70 text-sm leading-relaxed">{copy.body}</p>

      <AnimatePresence>
        {props.selected && copy.selectFlourish ? (
          <motion.p
            key="flourish"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            className="text-primary mt-1 text-sm italic"
            data-testid="all-in-flourish"
          >
            {copy.selectFlourish}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </motion.label>
  );
}

function TotalLine(props: {
  cadence: CommitmentCadence;
  totalCents: number;
  setupFeeCents: number;
}) {
  return (
    <div
      className="border-border flex flex-col gap-1 border-t pt-4"
      data-testid="checkout-total-line"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-foreground/70 text-sm">
          {CHECKOUT_TOTAL_COPY.todayLabel}
        </p>
        <p className="font-heading text-xl font-semibold">
          ${formatCentsAud(props.totalCents)}
          <span className="text-foreground/50 ml-1 text-xs font-normal">
            {CHECKOUT_TOTAL_COPY.gstNote}
          </span>
        </p>
      </div>
      {props.cadence === "monthly" && props.setupFeeCents > 0 ? (
        <p className="text-foreground/50 text-xs">
          {CHECKOUT_TOTAL_COPY.setupFeeFootnoteTemplate(
            formatCentsAud(props.setupFeeCents),
          )}
        </p>
      ) : null}
    </div>
  );
}

function ErrorSurface({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      className="rounded-md border border-[var(--brand-red)]/40 p-3 text-sm"
      data-testid="checkout-error"
    >
      <p
        className="font-medium"
        style={{ color: "var(--brand-red)" }}
      >
        {CHECKOUT_ERROR_COPY.heading}
      </p>
      <p className="text-foreground/80 mt-1 text-sm leading-relaxed">
        {CHECKOUT_ERROR_COPY.bodyTemplate(message)}
      </p>
    </motion.div>
  );
}

function PaymentPhase(props: {
  clientSecret: string | null;
  cadence: CommitmentCadence;
  totalCents: number;
  setupFeeCents: number;
  email: string;
}) {
  if (!props.clientSecret) {
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
    <section
      className="flex flex-col gap-5"
      data-testid="checkout-payment-phase"
      data-voice-suppressed="true"
    >
      <TotalLine
        cadence={props.cadence}
        totalCents={props.totalCents}
        setupFeeCents={props.setupFeeCents}
      />
      <Elements
        stripe={getStripePromise()}
        options={{
          clientSecret: props.clientSecret,
          appearance: { theme: "stripe", variables: { colorPrimary: "#cc2a2a" } },
        }}
      >
        <PayForm email={props.email} />
      </Elements>
    </section>
  );
}

function PayForm({ email }: { email: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const returnUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/get-started/welcome?email=${encodeURIComponent(email)}`
      : "/get-started/welcome";

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setSubmitting(true);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    window.location.href = returnUrl;
  }

  return (
    <form onSubmit={handlePay} className="flex flex-col gap-5">
      <PaymentElement options={{ layout: "tabs" }} />
      {error ? <ErrorSurface message={error} /> : null}
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="bg-primary text-primary-foreground inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition-transform hover:translate-y-[-1px] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="checkout-pay-button"
      >
        {submitting
          ? CHECKOUT_CONTINUE_COPY.payProcessingLabel
          : CHECKOUT_CONTINUE_COPY.payLabel}
      </button>
    </form>
  );
}
