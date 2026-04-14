/**
 * QB-E2E fixtures — deterministic, idempotent.
 *
 * Seeds one company (manual billing), one primary contact with email, one
 * deal in `quoted` stage, one project-structure quote already in `sent`
 * status with one line item, a `quote_sent` activity_log row, and
 * current-effective rows for `terms_of_service` + `privacy_policy`.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedQbE2e(db)` (module import) —
 *     the preferred path, so the fixture lives in the same hermetic DB
 *     the globalSetup migrated.
 *   - CLI for ad-hoc local verification:
 *       DB_FILE_PATH=./dev.db npx tsx scripts/seed-qb-e2e.ts
 *
 * Status `sent` is seeded directly (rather than driving the admin UI
 * Send button) because the Send path depends on Anthropic SDK + email
 * composition which isn't the subject under test here. The admin Send
 * flow is covered by QB-3 unit tests; QB-E2E's job is the public
 * accept flow end-to-end.
 *
 * Owner: QB-E2E. Consumer: tests/e2e/qb-e2e.spec.ts.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { quotes } from "@/lib/db/schema/quotes";
import { activity_log } from "@/lib/db/schema/activity-log";
import { legal_doc_versions } from "@/lib/db/schema/legal-doc-versions";
import {
  QUOTE_CONTENT_VERSION,
  type QuoteContent,
} from "@/lib/quote-builder/content-shape";

type DB = ReturnType<typeof drizzle<typeof schema>>;

export const QB_E2E = {
  companyId: "e2e-qb-company",
  contactId: "e2e-qb-contact",
  dealId: "e2e-qb-deal",
  quoteId: "e2e-qb-quote",
  quoteToken: "e2eqbtoken0000000000000000000000",
  quoteNumber: "SB-2026-9001",
  tosVersionId: "e2e-tos-v1",
  privacyVersionId: "e2e-privacy-v1",
  primaryEmail: "e2e-client@example.com",
  companyName: "E2E Test Co",
  adminUserId: "e2e-admin-user", // mirrors E2E_USER.id in seed-db.ts
} as const;

function projectContent(): QuoteContent {
  return {
    version: QUOTE_CONTENT_VERSION,
    sections: {
      whatYouToldUs: {
        prose: "E2E seeded — client wants a single project deliverable.",
        provenance: null,
        confidence: "high",
      },
      whatWellDo: {
        prose: "One-off project scope.",
        line_items: [
          {
            id: "e2e-line-1",
            kind: "one_off",
            snapshot: {
              catalogue_item_id: null,
              name: "E2E project deliverable",
              category: "project",
              unit: "project",
              base_price_cents_inc_gst: 250_000,
              tier_rank: null,
            },
            qty: 1,
            unit_price_cents_inc_gst: 250_000,
          },
        ],
      },
      terms: { template_id: null, overrides_prose: "" },
    },
    term_length_months: null,
    expiry_days: 14,
  };
}

export interface SeedResult {
  quoteId: string;
  quoteToken: string;
  dealId: string;
  companyId: string;
  contactId: string;
}

export async function seedQbE2e(db: DB): Promise<SeedResult> {
  const now = Date.now();

  // 1. Company (manual billing mode → manual accept path)
  await db
    .insert(companies)
    .values({
      id: QB_E2E.companyId,
      name: QB_E2E.companyName,
      name_normalised: QB_E2E.companyName.toLowerCase(),
      billing_mode: "manual",
      trial_shoot_status: "none",
      gst_applicable: true,
      first_seen_at_ms: now,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  // 2. Primary contact with email (required for settle email enqueue)
  await db
    .insert(contacts)
    .values({
      id: QB_E2E.contactId,
      company_id: QB_E2E.companyId,
      name: "E2E Client",
      email: QB_E2E.primaryEmail,
      email_normalised: QB_E2E.primaryEmail,
      email_status: "valid",
      is_primary: true,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  // 3. Deal in `quoted` stage
  await db
    .insert(deals)
    .values({
      id: QB_E2E.dealId,
      company_id: QB_E2E.companyId,
      primary_contact_id: QB_E2E.contactId,
      title: "E2E deal",
      stage: "quoted",
      value_cents: 250_000,
      value_estimated: true,
      last_stage_change_at_ms: now,
      pause_used_this_commitment: false,
      created_at_ms: now,
      updated_at_ms: now,
    })
    .onConflictDoNothing();

  // 4. Quote — seeded directly in `sent` status
  const content = projectContent();
  await db
    .insert(quotes)
    .values({
      id: QB_E2E.quoteId,
      deal_id: QB_E2E.dealId,
      company_id: QB_E2E.companyId,
      token: QB_E2E.quoteToken,
      quote_number: QB_E2E.quoteNumber,
      status: "sent",
      structure: "project",
      content_json: content,
      catalogue_snapshot_json: null,
      total_cents_inc_gst: 250_000,
      retainer_monthly_cents_inc_gst: null,
      one_off_cents_inc_gst: 250_000,
      term_length_months: null,
      buyout_percentage: 50,
      created_at_ms: now - 60_000,
      sent_at_ms: now - 30_000,
      expires_at_ms: now + 14 * 24 * 60 * 60 * 1000,
      last_edited_by_user_id: QB_E2E.adminUserId,
    })
    .onConflictDoNothing();

  // 5. quote_sent activity log — mirrors sendQuoteAction behaviour
  const existingQuoteSent = await db
    .select({ id: activity_log.id })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.deal_id, QB_E2E.dealId),
        eq(activity_log.kind, "quote_sent"),
      ),
    )
    .limit(1);
  if (existingQuoteSent.length === 0) {
    await db.insert(activity_log).values({
      id: randomUUID(),
      company_id: QB_E2E.companyId,
      contact_id: QB_E2E.contactId,
      deal_id: QB_E2E.dealId,
      kind: "quote_sent",
      body: `E2E seed — quote ${QB_E2E.quoteNumber} sent.`,
      meta: { quote_id: QB_E2E.quoteId, seeded: true },
      created_at_ms: now - 30_000,
      created_by: QB_E2E.adminUserId,
    });
  }

  // 6. Legal doc versions — accept flow stamps these IDs
  await db
    .insert(legal_doc_versions)
    .values([
      {
        id: QB_E2E.tosVersionId,
        doc_type: "terms_of_service",
        version: "e2e-v1",
        effective_from_ms: now,
        created_at_ms: now,
      },
      {
        id: QB_E2E.privacyVersionId,
        doc_type: "privacy_policy",
        version: "e2e-v1",
        effective_from_ms: now,
        created_at_ms: now,
      },
    ])
    .onConflictDoNothing();

  return {
    quoteId: QB_E2E.quoteId,
    quoteToken: QB_E2E.quoteToken,
    dealId: QB_E2E.dealId,
    companyId: QB_E2E.companyId,
    contactId: QB_E2E.contactId,
  };
}

// CLI entry — usable against dev.db for local verification.
if (require.main === module) {
  (async () => {
    const { db } = await import("@/lib/db");
    const result = await seedQbE2e(db as unknown as DB);
    // eslint-disable-next-line no-console
    console.warn("QB-E2E seed complete:", result);
    process.exit(0);
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}

// Suppress unused imports the tree-shaker might complain about.
void randomBytes;
