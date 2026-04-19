/**
 * CM-E2E fixtures — deterministic, idempotent.
 *
 * Seeds one company, one primary contact (pre-retainer, onboarding seen),
 * and one unconsumed portal magic link. The raw token is exported so the
 * E2E spec can hit `/lite/portal/r/<rawToken>` to redeem and enter the
 * portal.
 *
 * Callable from:
 *   - Playwright `test.beforeAll` via `seedCmE2e(db)` (module import).
 *   - CLI: DB_FILE_PATH=./dev.db npx tsx scripts/seed-cm-e2e.ts
 *
 * Owner: CM-E2E. Consumer: tests/e2e/portal-auth.spec.ts.
 */
import { createHash, randomUUID } from "node:crypto";
import type { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "@/lib/db/schema";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { portal_magic_links } from "@/lib/db/schema/portal-magic-links";

type DB = ReturnType<typeof drizzle<typeof schema>>;

const RAW_TOKEN = "cme2e-portal-token-0000000000000000";
const OTT_HASH = createHash("sha256").update(RAW_TOKEN).digest("hex");
const NOW = Date.now();

export const CM_E2E = {
  companyId: "e2e-cm-company",
  contactId: "e2e-cm-contact",
  contactName: "Test Client",
  contactEmail: "e2e-portal@example.com",
  companyName: "E2E Portal Co",
  rawToken: RAW_TOKEN,
  portalUrlToken: "e2e-portal",
} as const;

export async function seedCmE2e(db: DB): Promise<void> {
  await db
    .insert(companies)
    .values({
      id: CM_E2E.companyId,
      name: CM_E2E.companyName,
      name_normalised: CM_E2E.companyName.toLowerCase(),
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .onConflictDoNothing();

  await db
    .insert(contacts)
    .values({
      id: CM_E2E.contactId,
      company_id: CM_E2E.companyId,
      name: CM_E2E.contactName,
      email: CM_E2E.contactEmail,
      email_normalised: CM_E2E.contactEmail.toLowerCase(),
      is_primary: true,
      onboarding_welcome_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .onConflictDoNothing();

  await db
    .insert(portal_magic_links)
    .values({
      id: randomUUID(),
      contact_id: CM_E2E.contactId,
      client_id: null,
      submission_id: null,
      ott_hash: OTT_HASH,
      issued_for: "portal_access",
      expires_at_ms: NOW + 7 * 24 * 60 * 60 * 1000,
      consumed_at_ms: null,
      created_at_ms: NOW,
    })
    .onConflictDoNothing();
}

if (require.main === module) {
  (async () => {
    const Database = (await import("better-sqlite3")).default;
    const { drizzle } = await import("drizzle-orm/better-sqlite3");
    const dbPath = process.env.DB_FILE_PATH ?? "./dev.db";
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    const db = drizzle(sqlite, { schema });
    await seedCmE2e(db);
    sqlite.close();
    console.error("CM-E2E seed complete.");
  })();
}
