import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";
import { normaliseEmail } from "@/lib/crm/normalise";
import { transitionDealStage } from "@/lib/crm/transition-deal-stage";

import type { DispatchOutcome, ResendWebhookEvent } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleEmailComplainedOpts {
  nowMs?: number;
  eventId: string;
  dbArg?: Db;
}

function firstRecipient(event: ResendWebhookEvent): string | null {
  const to = event.data?.to;
  if (!to) return null;
  if (Array.isArray(to)) return to[0] ?? null;
  return typeof to === "string" ? to : null;
}

/**
 * Handle `email.complained` from Resend. Brand-reputation event — much
 * harsher than a bounce.
 *
 * - Mark contact `email_status='complained'`.
 * - Mark `Company.do_not_contact=true`.
 * - Roll the contact's `contacted` or `conversation` deals back to
 *   `lead` (freeze is enforced by the DNC flag gating future sends;
 *   per §3.4 "freeze it").
 * - Add `bounce`/`complaint` suppression row.
 * - Log activity row `email_complained`.
 */
export async function handleEmailComplained(
  event: ResendWebhookEvent,
  opts: HandleEmailComplainedOpts,
): Promise<DispatchOutcome> {
  const nowMs = opts.nowMs ?? Date.now();
  const database = (opts.dbArg ?? defaultDb) as Db;

  const recipient = firstRecipient(event);
  if (!recipient) {
    return { result: "error", error: "missing_recipient" };
  }

  const normalised = normaliseEmail(recipient);
  if (!normalised) {
    return { result: "error", error: "invalid_recipient" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = database as any;

  await tx.insert(email_suppressions).values({
    id: randomUUID(),
    email: recipient,
    kind: "complaint",
    classification: null,
    reason: `resend:complaint:${opts.eventId}`,
    suppressed_at_ms: nowMs,
    created_by: "resend_webhook",
  });

  const contact = await tx
    .select()
    .from(contacts)
    .where(eq(contacts.email_normalised, normalised))
    .limit(1)
    .then((r: typeof contacts.$inferSelect[]) => r[0]);

  if (!contact) {
    return { result: "skipped", error: "contact_not_found" };
  }

  await tx
    .update(contacts)
    .set({ email_status: "complained", updated_at_ms: nowMs })
    .where(eq(contacts.id, contact.id));

  await tx
    .update(companies)
    .set({ do_not_contact: true, updated_at_ms: nowMs })
    .where(eq(companies.id, contact.company_id));

  await tx.insert(activity_log).values({
    id: randomUUID(),
    company_id: contact.company_id,
    contact_id: contact.id,
    deal_id: null,
    kind: "email_complained",
    body: `Spam complaint from ${recipient}. Company marked do_not_contact.`,
    meta: {
      source: "resend_webhook",
      event_id: opts.eventId,
    },
    created_at_ms: nowMs,
    created_by: "resend_webhook",
  });

  // Roll back `contacted` and `conversation` deals for this contact.
  const candidateDeals = await tx
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.primary_contact_id, contact.id),
        inArray(deals.stage, ["contacted", "conversation"] as const),
      ),
    );

  for (const row of candidateDeals) {
    try {
      transitionDealStage(
        row.id,
        "lead",
        {
          by: "resend_webhook",
          nowMs,
          meta: {
            source: "resend_webhook",
            event_id: opts.eventId,
            reason: "complaint_rollback",
          },
        },
        database,
      );
    } catch (err) {
      console.error(
        `[resend.email_complained] rollback deal ${row.id} failed:`,
        err,
      );
    }
  }

  return { result: "ok" };
}
