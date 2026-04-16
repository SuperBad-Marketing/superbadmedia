"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type { SupportCustomerContext } from "../_queries/load-support-customer-context";

/**
 * Collapsible right-side panel for the support@ ticket overlay
 * (spec §4.3). Intro line sets the "who they are, where they are" frame
 * per `project_two_perpetual_contexts`. Panel stays mounted when
 * collapsed — §16 #60 forbids unmounting the composer, and the overlay
 * sits above it.
 */
export function CustomerContextPanel({
  contactName,
  context,
  defaultOpen = false,
}: {
  contactName: string | null;
  context: SupportCustomerContext;
  defaultOpen?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <aside className="flex h-full w-full flex-col border-l border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 border-b border-[color:var(--color-neutral-700)] px-4 py-3 text-left",
          "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
        )}
      >
        <div className="flex flex-col gap-0.5">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Customer context
          </span>
          <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-small)] text-[color:var(--color-brand-pink)]">
            Who they are, where they are.
          </em>
        </div>
        <Icon
          size={16}
          strokeWidth={1.5}
          aria-hidden
          className="text-[color:var(--color-neutral-300)]"
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0.18 } : houseSpring}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-5 px-4 py-5">
              <SubscriptionBlock
                contactName={contactName}
                context={context}
              />
              <UsageBlock context={context} />
              <ActivityBlock context={context} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function SubscriptionBlock({
  contactName,
  context,
}: {
  contactName: string | null;
  context: SupportCustomerContext;
}) {
  const sub = context.subscription;
  const retainer = context.retainerActive;

  const header = contactName ?? "This customer";

  if (!sub && !retainer) {
    return (
      <Block title="Subscription">
        <Row label={header} value="Not a subscriber" />
      </Block>
    );
  }

  return (
    <Block title="Subscription">
      {sub && (
        <>
          <Row label="Product" value={sub.product_name} />
          <Row label="Tier" value={`${sub.tier_name} (rank ${sub.tier_rank})`} />
          <Row label="State" value={formatSubscriptionState(sub.subscription_state)} />
          {sub.billing_cadence && (
            <Row label="Cadence" value={formatCadence(sub.billing_cadence)} />
          )}
          <Row
            label="Monthly"
            value={`A$${(sub.monthly_price_cents_inc_gst / 100).toFixed(2)} inc. GST`}
          />
        </>
      )}
      {retainer && <Row label="Retainer" value="Active" />}
      <Row
        label="Last payment"
        value={
          context.payments.last_payment_at_ms
            ? formatDate(context.payments.last_payment_at_ms)
            : "None on record"
        }
      />
      {context.payments.payment_failure_count > 0 && (
        <Row
          label="Payment failures this cycle"
          value={String(context.payments.payment_failure_count)}
          emphasis
        />
      )}
    </Block>
  );
}

function UsageBlock({ context }: { context: SupportCustomerContext }) {
  if (!context.subscription) return null;
  const { usage } = context;
  return (
    <Block title="Usage this period">
      {usage.dimensions.length === 0 ? (
        <Row label="Usage" value="None recorded yet" />
      ) : (
        usage.dimensions.map((d) => (
          <Row
            key={d.dimension_key}
            label={d.dimension_key}
            value={String(d.amount)}
          />
        ))
      )}
    </Block>
  );
}

function ActivityBlock({ context }: { context: SupportCustomerContext }) {
  if (context.recentActivity.length === 0) return null;
  return (
    <Block title="Recent activity">
      <ul className="flex flex-col gap-2">
        {context.recentActivity.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-col gap-0.5 border-l border-[color:var(--color-neutral-700)] pl-3"
          >
            <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-100)]">
              {entry.body}
            </span>
            <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
              {formatRelative(entry.created_at_ms)} · {entry.kind}
            </span>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-1">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-500)]">
        {label}
      </span>
      <span
        className={cn(
          "text-right font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
          emphasis
            ? "text-[color:var(--color-brand-pink)]"
            : "text-[color:var(--color-neutral-100)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function formatSubscriptionState(state: string): string {
  switch (state) {
    case "active":
      return "Active";
    case "past_due":
      return "Past due";
    case "paused":
      return "Paused";
    case "pending_early_exit":
      return "Pending early exit";
    case "cancelled_paid_remainder":
      return "Cancelled — paid remainder";
    case "cancelled_buyout":
      return "Cancelled — buyout";
    case "cancelled_post_term":
      return "Cancelled";
    case "ended_gracefully":
      return "Ended";
    default:
      return state;
  }
}

function formatCadence(cadence: string): string {
  switch (cadence) {
    case "monthly":
      return "Monthly";
    case "annual_monthly":
      return "Annual — billed monthly";
    case "annual_upfront":
      return "Annual — upfront";
    default:
      return cadence;
  }
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(ms: number): string {
  const diffMs = Date.now() - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return "today";
  const days = Math.round(diffMs / day);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
