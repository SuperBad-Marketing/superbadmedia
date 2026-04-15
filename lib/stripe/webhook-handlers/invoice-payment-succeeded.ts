import type Stripe from "stripe";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { contacts } from "@/lib/db/schema/contacts";
import { user as userTable } from "@/lib/db/schema/user";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";
import type { DispatchOutcome } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleInvoiceSucceededOpts {
  nowMs?: number;
  dbArg?: Db;
  eventId: string;
}

function subscriptionId(
  invoice: Stripe.Invoice,
): string | null {
  const sub = (invoice as unknown as { subscription?: string | { id?: string } | null })
    .subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  return sub.id ?? null;
}

/**
 * `invoice.payment_succeeded` — fires every successful cycle. We only act
 * when this confirms a recovery from `past_due`; otherwise (a healthy
 * monthly charge on an `active` subscription) no log, no write. The
 * ongoing-cycle record lives in the `invoices` table (Branded Invoicing),
 * not activity_log, to avoid noise. One-off invoices are skipped.
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  opts: HandleInvoiceSucceededOpts,
): Promise<DispatchOutcome> {
  const subId = subscriptionId(invoice);
  if (!subId) {
    return { result: "skipped", error: "not_subscription_invoice" };
  }

  const database = (opts.dbArg ?? defaultDb) as Db;

  const deal = await database
    .select()
    .from(deals)
    .where(eq(deals.stripe_subscription_id, subId))
    .get();
  if (!deal) {
    return { result: "error", error: `deal_not_found_for_subscription:${subId}` };
  }

  const nowMs = opts.nowMs ?? Date.now();

  // --- SB-6a: first-payment subscriber login link ---
  // If this is a SaaS subscription deal and we've never issued a login
  // link to its contact, issue + send one. Idempotent via
  // `subscriber_magic_link_tokens` existence on `issued_for =
  // "subscriber_login_initial"`.
  if (deal.saas_product_id && deal.primary_contact_id) {
    await maybeIssueInitialSubscriberLoginLink({
      database,
      deal,
      eventId: opts.eventId,
      nowMs,
    });
  }

  if (deal.subscription_state !== "past_due") {
    return { result: "ok" };
  }

  await database
    .update(deals)
    .set({ subscription_state: "active", updated_at_ms: nowMs })
    .where(eq(deals.id, deal.id));

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Subscription payment recovered — past_due → active.`,
    meta: {
      kind: "subscription_payment_recovered",
      stripe_subscription_id: subId,
      stripe_invoice_id: invoice.id,
      previous_state: "past_due",
      new_state: "active",
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });

  return { result: "ok" };
}

async function maybeIssueInitialSubscriberLoginLink(args: {
  database: Db;
  deal: typeof deals.$inferSelect;
  eventId: string;
  nowMs: number;
}): Promise<void> {
  const { database, deal, eventId, nowMs } = args;
  if (!deal.primary_contact_id || !deal.saas_product_id) return;

  const contact = await database
    .select({
      id: contacts.id,
      email: contacts.email_normalised,
    })
    .from(contacts)
    .where(eq(contacts.id, deal.primary_contact_id))
    .get();
  if (!contact?.email) return;

  const userRow = await database
    .select({ id: userTable.id, email: userTable.email })
    .from(userTable)
    .where(eq(userTable.email, contact.email))
    .get();
  if (!userRow) return;

  // Idempotency: if we've ever issued an "initial" link for this user,
  // skip. Webhook re-deliveries from Stripe must not spam.
  const existing = await database
    .select({ id: subscriber_magic_link_tokens.id })
    .from(subscriber_magic_link_tokens)
    .where(
      and(
        eq(subscriber_magic_link_tokens.user_id, userRow.id),
        eq(
          subscriber_magic_link_tokens.issued_for,
          "subscriber_login_initial",
        ),
      ),
    )
    .get();
  if (existing) return;

  const product = await database
    .select({ name: saas_products.name })
    .from(saas_products)
    .where(eq(saas_products.id, deal.saas_product_id as string))
    .get();
  const tier = deal.saas_tier_id
    ? await database
        .select({ name: saas_tiers.name })
        .from(saas_tiers)
        .where(eq(saas_tiers.id, deal.saas_tier_id))
        .get()
    : null;

  // Lazy imports — keeps the email transport (Resend client) off the
  // module graph of unrelated Stripe dispatch tests that don't set
  // RESEND_API_KEY.
  const { issueSubscriberMagicLink } = await import(
    "@/lib/auth/subscriber-magic-link"
  );
  const { sendSubscriberLoginEmail } = await import(
    "@/lib/emails/subscriber-login"
  );

  const { url } = await issueSubscriberMagicLink(
    { userId: userRow.id, issuedFor: "subscriber_login_initial" },
    database,
  );

  try {
    await sendSubscriberLoginEmail({
      to: userRow.email,
      magicLinkUrl: url,
      productName: product?.name ?? "SuperBad",
      tierName: tier?.name ?? "",
      context: "initial",
    });
  } catch (err) {
    // Record but don't fail the webhook — the token is already issued;
    // the user can hit "send me my login" on the welcome page.
    await database.insert(activity_log).values({
      id: randomUUID(),
      company_id: deal.company_id,
      deal_id: deal.id,
      kind: "note",
      body: "Subscriber initial login email send failed — token issued, user can resend.",
      meta: {
        kind: "subscriber_initial_login_email_failed",
        user_id: userRow.id,
        stripe_event_id: eventId,
        error: (err as Error)?.message ?? String(err),
      },
      created_at_ms: nowMs,
      created_by: "stripe_webhook",
    });
    return;
  }

  await database.insert(activity_log).values({
    id: randomUUID(),
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "note",
    body: `Subscriber login link sent to ${userRow.email}.`,
    meta: {
      kind: "subscriber_initial_login_link_sent",
      user_id: userRow.id,
      stripe_event_id: eventId,
    },
    created_at_ms: nowMs,
    created_by: "stripe_webhook",
  });
}
