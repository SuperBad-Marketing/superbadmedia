import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { db as defaultDb } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";
import { normaliseEmail } from "@/lib/crm/normalise";
import { transitionDealStage } from "@/lib/crm/transition-deal-stage";

import type { DispatchOutcome, ResendWebhookEvent } from "./types";

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

export interface HandleEmailBouncedOpts {
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

function bounceType(event: ResendWebhookEvent): "hard" | "soft" {
  const raw =
    event.data?.bounce?.type ?? event.data?.bounce_type ?? "hard";
  return raw === "soft" ? "soft" : "hard";
}

/**
 * Handle `email.bounced` from Resend.
 *
 * Hard bounce → mark contact `invalid`, add `bounce` suppression, and
 * roll any `contacted` deals for this contact back to `lead`. Safety rule
 * per sales-pipeline §3.4: rollback only fires if the deal is still in
 * `contacted`. A deal already moved past `contacted` just flags the
 * contact.
 *
 * Soft bounce → flag contact `soft_bounce`, suppress, no rollback.
 *
 * Idempotent by webhook event id (upstream `webhook_events` PK).
 */
export async function handleEmailBounced(
  event: ResendWebhookEvent,
  opts: HandleEmailBouncedOpts,
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

  const classification = bounceType(event);
  const nextStatus = classification === "hard" ? "invalid" : "soft_bounce";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tx = database as any;

  const contact = await tx
    .select()
    .from(contacts)
    .where(eq(contacts.email_normalised, normalised))
    .limit(1)
    .then((r: typeof contacts.$inferSelect[]) => r[0]);

  // Always record the suppression, even if contact not found — protects
  // future sends to the same address before a contact exists.
  await tx.insert(email_suppressions).values({
    id: randomUUID(),
    email: recipient,
    kind: "bounce",
    classification: null,
    reason: `resend:${classification}_bounce:${opts.eventId}`,
    suppressed_at_ms: nowMs,
    created_by: "resend_webhook",
  });

  if (!contact) {
    return { result: "skipped", error: "contact_not_found" };
  }

  await tx
    .update(contacts)
    .set({ email_status: nextStatus, updated_at_ms: nowMs })
    .where(eq(contacts.id, contact.id));

  await tx.insert(activity_log).values({
    id: randomUUID(),
    company_id: contact.company_id,
    contact_id: contact.id,
    deal_id: null,
    kind: "email_bounced",
    body: `${classification === "hard" ? "Hard" : "Soft"} bounce for ${recipient}.`,
    meta: {
      source: "resend_webhook",
      event_id: opts.eventId,
      bounce_type: classification,
    },
    created_at_ms: nowMs,
    created_by: "resend_webhook",
  });

  if (classification === "soft") {
    return { result: "ok" };
  }

  // Hard bounce: roll back any `contacted` deals for this contact to `lead`.
  const candidateDeals = await tx
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.primary_contact_id, contact.id),
        eq(deals.stage, "contacted"),
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
            reason: "hard_bounce_rollback",
          },
        },
        database,
      );
    } catch (err) {
      // Never propagate — record and keep going. Rollback best-effort.
      console.error(
        `[resend.email_bounced] rollback deal ${row.id} failed:`,
        err,
      );
    }
  }

  return { result: "ok" };
}
