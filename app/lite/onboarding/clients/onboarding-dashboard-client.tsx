"use client";

/**
 * SB-6b / SB-7 — authed SaaS subscriber dashboard.
 *
 * Status variants driven by `subscriptionState` + usage posture:
 *   - `at_cap`                 → full-page takeover with upgrade CTA
 *                                (SB-7; promoted above `active` when any
 *                                dimension is at/over its tier limit)
 *   - `active`                 → Brand DNA CTA hero + sticky usage bar
 *   - `past_due`               → "Payment didn't land" + billing portal link
 *   - anything else (null,
 *     incomplete, paused, …)   → "We're still waiting on Stripe" + portal link
 *
 * The sticky usage bar (SB-7) is ambient awareness per spec §5.2 —
 * calm when comfortable, dry observation when approaching cap. Hard cap
 * promotes the whole page to `at_cap` takeover per brief §Reconcile.
 */
import Link from "next/link";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";
import type { SubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import type {
  DashboardUsageSnapshot,
  DimensionSnapshot,
  NextTierInfo,
} from "@/lib/saas-products/usage";
import { requestSubscriberUpgradeAction } from "../actions-tier-change";
import { PastDueCardUpdateClient } from "./past-due-card-update-client";

function cadenceLabel(c: string | null): string {
  if (c === "annual_upfront") return "Annual — paid upfront";
  if (c === "annual_monthly") return "Annual — billed monthly";
  if (c === "monthly") return "Monthly";
  return "—";
}

type Props = {
  summary: SubscriberSummary;
  usage?: DashboardUsageSnapshot | null;
  /** SB-9: when true, past_due variant renders inline SetupIntent card update. */
  paymentRecoveryEnabled?: boolean;
};

type Variant = "at_cap" | "active" | "past_due" | "waiting";

function resolveVariant(
  state: string | null,
  usage: DashboardUsageSnapshot | null | undefined,
): Variant {
  if (state === "active" && usage?.anyAtCap) return "at_cap";
  if (state === "active") return "active";
  if (state === "past_due") return "past_due";
  return "waiting";
}

export function OnboardingDashboardClient({
  summary,
  usage,
  paymentRecoveryEnabled,
}: Props) {
  const variant = resolveVariant(summary.subscriptionState, usage);

  return (
    <main
      className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-start justify-center gap-8 px-6 py-16"
      data-testid="subscriber-onboarding"
      data-variant={variant}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={variant}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={houseSpring}
          className="flex w-full flex-col gap-6"
        >
          <header className="flex flex-col gap-3">
            <p className="text-foreground/50 text-xs uppercase tracking-[0.22em]">
              {headerEyebrow(variant)}
            </p>
            <h1 className="font-heading text-3xl font-semibold md:text-4xl">
              {headline(variant)}
            </h1>
          </header>

          <motion.section
            layout
            transition={houseSpring}
            className="border-foreground/10 rounded-md border px-5 py-4 text-sm"
            data-testid="subscription-summary"
          >
            <div className="text-foreground/60 mb-1 text-xs uppercase tracking-[0.18em]">
              Your subscription
            </div>
            <div className="text-base font-semibold">
              {summary.productName}
              {summary.tierName ? ` · ${summary.tierName}` : ""}
            </div>
            <div className="text-foreground/70 text-sm">
              {cadenceLabel(summary.billingCadence)}
              {summary.subscriptionState
                ? ` · ${humanState(summary.subscriptionState)}`
                : ""}
            </div>
          </motion.section>

          {variant === "at_cap" && usage ? (
            <AtCapHero usage={usage} productName={summary.productName} />
          ) : variant === "active" ? (
            <BrandDnaHero />
          ) : variant === "past_due" ? (
            paymentRecoveryEnabled ? (
              <PastDueCardUpdateClient productName={summary.productName} />
            ) : (
              <BillingPortalHero variant="past_due" />
            )
          ) : (
            <BillingPortalHero variant="waiting" />
          )}

          {variant === "active" && usage && usage.dimensions.length > 0 ? (
            <UsageStickyBar usage={usage} />
          ) : null}

          {variant === "active" ? (
            <p
              className="text-foreground/60 text-sm leading-relaxed"
              data-testid="followup-line"
            >
              Andy will be in touch within a business day.
            </p>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function headerEyebrow(v: Variant): string {
  if (v === "active") return "You're in";
  if (v === "at_cap") return "Hit the ceiling";
  return "One loose end";
}

function headline(v: Variant): string {
  if (v === "active") return "Welcome to SuperBad.";
  if (v === "at_cap") return "You've maxed the tier.";
  if (v === "past_due") return "Payment didn't land.";
  return "Still warming up.";
}

function humanState(s: string): string {
  if (s === "active") return "active";
  if (s === "past_due") return "payment failed";
  if (s === "paused") return "paused";
  return s.replaceAll("_", " ");
}

function BrandDnaHero() {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={houseSpring}
      className="w-full"
      data-testid="brand-dna-hero"
    >
      <Link
        href="/lite/brand-dna"
        className="bg-foreground text-background hover:bg-foreground/90 flex w-full flex-col gap-2 rounded-md px-6 py-8 no-underline transition-colors"
        data-testid="brand-dna-cta"
      >
        <span className="text-xs uppercase tracking-[0.22em] opacity-60">
          Step one
        </span>
        <span className="font-heading text-2xl font-semibold md:text-3xl">
          Teach SuperBad your brand.
        </span>
        <span className="text-sm opacity-80">
          Twenty minutes. Everything else is downstream of this.
        </span>
      </Link>
    </motion.div>
  );
}

function BillingPortalHero({ variant }: { variant: "past_due" | "waiting" }) {
  const copy =
    variant === "past_due"
      ? "Your card didn't go through. Update it and we're back on track."
      : "Stripe hasn't confirmed the first payment yet. Give it a minute, then refresh. If nothing changes, pop the billing details open below.";
  return (
    <div className="flex flex-col gap-4" data-testid="billing-portal-hero">
      <p className="text-foreground/80 text-base leading-relaxed">{copy}</p>
      <form action="/api/stripe/billing-portal" method="post">
        <motion.button
          type="submit"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={houseSpring}
          className="bg-foreground text-background hover:bg-foreground/90 rounded-md px-5 py-3 text-sm font-semibold"
          data-testid="billing-portal-button"
        >
          Open billing details
        </motion.button>
      </form>
    </div>
  );
}

function AtCapHero({
  usage,
  productName,
}: {
  usage: DashboardUsageSnapshot;
  productName: string;
}) {
  const atCapDim = usage.dimensions.find((d) => d.status === "at_cap");
  const resetIso = atCapDim
    ? new Date(atCapDim.resetsAtMs).toISOString().slice(0, 10)
    : null;
  return (
    <div className="flex flex-col gap-5" data-testid="at-cap-hero">
      <p className="text-foreground/80 text-base leading-relaxed">
        {atCapDim
          ? `You've used every ${atCapDim.displayName.toLowerCase()} this cycle. `
          : `You've maxed this tier. `}
        Two honest options:
      </p>
      <div className="flex flex-col gap-3">
        {usage.nextTier ? (
          <UpgradeCard
            productName={productName}
            currentTierName={usage.tierName}
            nextTier={usage.nextTier}
          />
        ) : (
          <div
            className="border-foreground/10 rounded-md border px-5 py-4 text-sm"
            data-testid="top-tier-notice"
          >
            <div className="font-semibold">You&apos;re already on the top tier.</div>
            <div className="text-foreground/70 mt-1">
              Have a word with us and we&apos;ll sort something custom.
            </div>
          </div>
        )}
        {resetIso ? (
          <div
            className="border-foreground/10 text-foreground/70 rounded-md border px-5 py-4 text-sm"
            data-testid="wait-for-reset"
          >
            Or wait it out — your cap resets on{" "}
            <span className="text-foreground font-semibold">{resetIso}</span>.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UpgradeCard({
  productName,
  currentTierName,
  nextTier,
}: {
  productName: string;
  currentTierName: string | null;
  nextTier: NextTierInfo;
}) {
  const priceAud = (nextTier.monthlyPriceCentsIncGst / 100).toFixed(0);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "success"; tierName: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  if (state.kind === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={houseSpring}
        data-testid="upgrade-celebration"
        className="bg-foreground text-background relative flex w-full flex-col gap-3 overflow-hidden rounded-md px-6 py-6"
      >
        <Confetti />
        <span className="text-xs uppercase tracking-[0.22em] opacity-60">
          Done
        </span>
        <span className="font-heading text-2xl font-semibold md:text-3xl">
          New tier&apos;s live.
        </span>
        <span className="text-sm opacity-80">
          {productName} · {state.tierName}. The next invoice will pick up the
          pro-ration.
        </span>
      </motion.div>
    );
  }

  const onClick = () => {
    setState({ kind: "idle" });
    startTransition(async () => {
      const res = await requestSubscriberUpgradeAction(nextTier.id);
      if (!res.ok) {
        setState({
          kind: "error",
          message: errorCopy(res.error),
        });
        return;
      }
      if (res.result && res.result.blocked) {
        setState({
          kind: "error",
          message: "Usage is above the target tier's limit — upgrade instead.",
        });
        return;
      }
      setState({ kind: "success", tierName: nextTier.name });
    });
  };

  return (
    <motion.div
      whileHover={{ y: pending ? 0 : -2 }}
      whileTap={{ scale: pending ? 1 : 0.98 }}
      transition={houseSpring}
      data-testid="upgrade-cta"
      data-pending={pending ? "true" : "false"}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="bg-foreground text-background hover:bg-foreground/90 flex w-full flex-col gap-2 rounded-md px-6 py-6 text-left no-underline transition-colors disabled:opacity-70"
      >
        <span className="text-xs uppercase tracking-[0.22em] opacity-60">
          {pending
            ? "Working…"
            : `Upgrade ${currentTierName ? `from ${currentTierName}` : ""}`}
        </span>
        <span className="font-heading text-xl font-semibold md:text-2xl">
          {productName} · {nextTier.name}
        </span>
        <span className="text-sm opacity-80">
          ${priceAud}/mo inc. GST · takes effect immediately
        </span>
      </button>
      {state.kind === "error" ? (
        <p
          className="text-foreground/70 mt-2 text-xs"
          data-testid="upgrade-error"
        >
          {state.message}
        </p>
      ) : null}
    </motion.div>
  );
}

function errorCopy(code: string | undefined): string {
  if (code === "tier_change_disabled") return "Tier changes are off right now. Try again shortly.";
  if (code === "invalid_subscription_state")
    return "Your subscription isn't in a state we can change right now. Open billing details.";
  if (code === "no_subscription") return "No subscription on file.";
  if (code === "unauthorised") return "Please sign in again.";
  return "Something went sideways. Try again in a minute.";
}

function Confetti() {
  const pieces = Array.from({ length: 12 });
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
      data-testid="confetti"
    >
      {pieces.map((_, i) => (
        <motion.span
          key={i}
          className="bg-background absolute block h-1.5 w-1.5 rounded-full"
          initial={{
            x: `${(i * 8) % 100}%`,
            y: "-10%",
            opacity: 0,
          }}
          animate={{
            y: "110%",
            opacity: [0, 1, 1, 0],
            rotate: i * 30,
          }}
          transition={{
            duration: 1.2 + (i % 4) * 0.15,
            delay: (i % 6) * 0.05,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

function UsageStickyBar({ usage }: { usage: DashboardUsageSnapshot }) {
  return (
    <section
      className="border-foreground/10 flex flex-col gap-3 rounded-md border px-5 py-4 text-sm"
      data-testid="usage-sticky-bar"
    >
      <div className="text-foreground/60 text-xs uppercase tracking-[0.18em]">
        This cycle
      </div>
      <ul className="flex flex-col gap-3">
        {usage.dimensions.map((d) => (
          <UsagePill key={d.dimensionKey} dimension={d} />
        ))}
      </ul>
    </section>
  );
}

function UsagePill({ dimension }: { dimension: DimensionSnapshot }) {
  const copy =
    dimension.limit === null
      ? `${dimension.used.toLocaleString()} ${dimension.displayName.toLowerCase()}`
      : `${dimension.used.toLocaleString()} / ${dimension.limit.toLocaleString()} ${dimension.displayName.toLowerCase()}`;

  const voice =
    dimension.status === "warn"
      ? "Making sure the juice is worth the squeeze."
      : dimension.status === "at_cap"
        ? "Full tank."
        : null;

  const barPct = dimension.percent === null ? 0 : Math.min(dimension.percent, 100);
  const barColor =
    dimension.status === "at_cap"
      ? "bg-foreground"
      : dimension.status === "warn"
        ? "bg-foreground/70"
        : "bg-foreground/40";

  return (
    <li
      className="flex flex-col gap-1.5"
      data-testid={`usage-pill-${dimension.dimensionKey}`}
      data-status={dimension.status}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground text-sm">{copy}</span>
        {voice ? (
          <span
            className="text-foreground/50 text-xs italic"
            data-testid={`usage-voice-${dimension.dimensionKey}`}
          >
            {voice}
          </span>
        ) : null}
      </div>
      {dimension.limit !== null ? (
        <div
          className="bg-foreground/10 h-1 w-full overflow-hidden rounded-full"
          aria-hidden
        >
          <motion.div
            className={`${barColor} h-full`}
            initial={{ width: 0 }}
            animate={{ width: `${barPct}%` }}
            transition={houseSpring}
          />
        </div>
      ) : null}
    </li>
  );
}
