/**
 * BI-E2E fixtures — deterministic, idempotent.
 *
 * Seeds the fixture shape BI-E2E asserts against:
 *   - Company (stripe billing, gst_applicable, 14d payment terms)
 *   - Primary contact with email
 *   - Won deal with active subscription state, no stripe_customer_id
 *   - One draft invoice with a single retainer line item — inserted
 *     directly (not via `generateInvoice()`) so this module is safe to
 *     import from Playwright spec files. `generate.ts` transitively
 *     imports `lib/db` (`server-only`) which poisons client bundles.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedBiE2e(db)` (hermetic DB).
 *   - CLI for local inspection:
 *       DB_FILE_PATH=./dev.db npx tsx scripts/seed-bi-e2e.ts
 *
 * Owner: BI-E2E. Consumer: tests/e2e/bi-e2e.spec.ts.
 */
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";
import { invoices } from "@/lib/db/schema/invoices";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const BI_E2E = {
  companyId: "e2e-bi-company",
  contactId: "e2e-bi-contact",
  dealId: "e2e-bi-deal",
  invoiceId: "e2e-bi-invoice",
  invoiceNumber: "SB-INV-2026-9001",
  invoiceToken: "e2ebitoken0000000000000000000000",
  companyName: "E2E Invoice Co",
  primaryEmail: "e2e-invoice-client@example.com",
  adminUserId: "e2e-admin-user",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BiSeedResult {
  companyId: string;
  contactId: string;
  dealId: string;
  invoiceId: string;
  invoiceToken: string;
  invoiceNumber: string;
}

export async function seedBiE2e(db: DB): Promise<BiSeedResult> {
  const now = Date.now();

  await db
    .insert(companies)
    .values({
      id: BI_E2E.companyId,
      name: BI_E2E.companyName,
      name_normalised: BI_E2E.companyName.toLowerCase(),
      billing_mode: "stripe",
      trial_shoot_status: "none",
      gst_applicable: true,
      payment_terms_days: 14,
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  await db
    .insert(contacts)
    .values({
      id: BI_E2E.contactId,
      company_id: BI_E2E.companyId,
      name: "E2E Invoice Client",
      email: BI_E2E.primaryEmail,
      email_normalised: BI_E2E.primaryEmail,
      email_status: "valid",
      is_primary: true,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  await db
    .insert(deals)
    .values({
      id: BI_E2E.dealId,
      company_id: BI_E2E.companyId,
      primary_contact_id: BI_E2E.contactId,
      title: "E2E invoice deal",
      stage: "won",
      won_outcome: "retainer",
      value_cents: 275_000,
      value_estimated: false,
      subscription_state: "active",
      stripe_customer_id: null,
      last_stage_change_at_ms: now,
      pause_used_this_commitment: false,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  // Hard-suppress the e2e recipient so `sendEmail()` short-circuits to
  // `{sent:false, skipped:true}` instead of calling Resend with a
  // placeholder API key (which Resend rejects at send-time). Bounce
  // suppression blocks transactional sends too — exactly what we want
  // for a hermetic admin-send → invoice-status assertion.
  await db
    .insert(email_suppressions)
    .values({
      id: "e2e-bi-suppression",
      email: BI_E2E.primaryEmail,
      kind: "bounce",
      classification: null,
      reason: "e2e:hermetic-stub",
      suppressed_at_ms: now,
      created_by: "bi-e2e-seed",
    })
    .onConflictDoNothing();

  // Idempotent: if a draft invoice for this deal already exists, reuse it.
  const existing = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, BI_E2E.invoiceId))
    .get();
  if (existing) {
    return {
      companyId: BI_E2E.companyId,
      contactId: BI_E2E.contactId,
      dealId: BI_E2E.dealId,
      invoiceId: existing.id,
      invoiceToken: existing.token,
      invoiceNumber: existing.invoice_number,
    };
  }

  const totalInc = 275_000;
  const totalEx = Math.round(totalInc / 1.1);
  const gst = totalInc - totalEx;

  await db
    .insert(invoices)
    .values({
      id: BI_E2E.invoiceId,
      invoice_number: BI_E2E.invoiceNumber,
      deal_id: BI_E2E.dealId,
      company_id: BI_E2E.companyId,
      quote_id: null,
      token: BI_E2E.invoiceToken,
      status: "draft",
      cycle_index: 0,
      cycle_start_ms: now,
      cycle_end_ms: now + 30 * DAY_MS,
      issue_date_ms: now,
      due_at_ms: now + 14 * DAY_MS,
      paid_at_ms: null,
      paid_via: null,
      stripe_payment_intent_id: null,
      total_cents_inc_gst: totalInc,
      total_cents_ex_gst: totalEx,
      gst_cents: gst,
      gst_applicable: true,
      line_items_json: [
        {
          description: "E2E retainer — monthly cycle",
          quantity: 1,
          unit_price_cents_inc_gst: totalInc,
          line_total_cents_inc_gst: totalInc,
          is_recurring: true,
        },
      ] as unknown as string,
      scope_summary: null,
      supersedes_invoice_id: null,
      thread_message_id: null,
      reminder_count: 0,
      last_reminder_at_ms: null,
      auto_send_at_ms: null,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  return {
    companyId: BI_E2E.companyId,
    contactId: BI_E2E.contactId,
    dealId: BI_E2E.dealId,
    invoiceId: BI_E2E.invoiceId,
    invoiceToken: BI_E2E.invoiceToken,
    invoiceNumber: BI_E2E.invoiceNumber,
  };
}

// Suppress unused-import warnings the tree-shaker might flag.
void randomBytes;

if (require.main === module) {
  (async () => {
    const { db } = await import("@/lib/db");
    const result = await seedBiE2e(db as unknown as DB);
    // eslint-disable-next-line no-console
    console.warn("BI-E2E seed complete:", result);
    process.exit(0);
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
