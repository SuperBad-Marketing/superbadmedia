import type Stripe from "stripe";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { finaliseDealAsWon } from "@/lib/crm/finalise-deal";
import { markCompanyTrialShootBooked } from "@/lib/crm/mark-company-trial-shoot-booked";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export const PRODUCT_TYPES = ["intro", "retainer", "saas"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export function isProductType(v: unknown): v is ProductType {
  return typeof v === "string" && (PRODUCT_TYPES as readonly string[]).includes(v);
}

export interface HandleCheckoutSessionOpts {
  nowMs?: number;
  dbArg?: Db;
  /** Event id — stamped into activity meta for traceability. */
  eventId: string;
}

/**
 * Branch on `session.metadata.product_type`, route into the right CRM
 * helper, and return a structured outcome. Never throws for "expected"
 * failures (missing metadata, unknown deal) — those return `error` and
 * let the caller write the reason into `webhook_events.error` + 200 the
 * response. Unexpected failures (DB down, etc.) propagate.
 */
export function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  opts: HandleCheckoutSessionOpts,
): DispatchOutcome {
  const metadata = session.metadata ?? {};
  const dealId = metadata.deal_id;
  const productType = metadata.product_type;

  if (!dealId) {
    return {
      result: "error",
      error: "missing_metadata.deal_id",
    };
  }
  if (!isProductType(productType)) {
    return {
      result: "error",
      error: `missing_or_unknown_metadata.product_type:${productType ?? "null"}`,
    };
  }

  const amount = session.amount_total;
  const meta = {
    source: "stripe_webhook",
    event_id: opts.eventId,
    product_type: productType,
    stripe_session_id: session.id,
  };

  try {
    if (productType === "intro") {
      markCompanyTrialShootBooked(
        dealId,
        { by: "stripe_webhook", meta, nowMs: opts.nowMs },
        opts.dbArg,
      );
      return { result: "ok" };
    }

    // retainer + saas: Won transition with value_cents.
    if (typeof amount !== "number") {
      return {
        result: "error",
        error: `missing_amount_total_for_won_product:${productType}`,
      };
    }
    const won_outcome = productType === "retainer" ? "retainer" : "saas";
    finaliseDealAsWon(
      dealId,
      { won_outcome, value_cents: amount },
      {
        by: "stripe_webhook",
        meta: { ...meta, amount_total: amount, currency: session.currency },
        nowMs: opts.nowMs,
      },
      opts.dbArg,
    );
    return { result: "ok" };
  } catch (err) {
    // CRM helpers throw on unknown deal, illegal transition, etc.
    // Treat these as recorded dispatch failures (not 500s) so Stripe
    // doesn't retry. The row is in `webhook_events` for triage.
    const message = err instanceof Error ? err.message : String(err);
    return { result: "error", error: message };
  }
}
