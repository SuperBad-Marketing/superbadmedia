/**
 * Company + contact auto-creation for SaaS signups.
 *
 * When a Subscriber completes Stripe payment, the system creates:
 *   1. A `companies` record (from signup form: business name, location)
 *   2. A `contacts` record (from signup form: name, email)
 *   3. Links the contact to the company as primary
 *
 * Solo operators who don't provide a business name: full name used as
 * company name. The record exists for data model consistency — Revenue
 * Segmentation and location always live on `companies`.
 *
 * Owner: OS-1.
 */
import { randomUUID } from "node:crypto";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import {
  normaliseEmail,
  normaliseCompanyName,
  normalisePhone,
} from "@/lib/crm/normalise";

export interface CreateCompanyFromSignupInput {
  /** Customer's full name from signup form */
  name: string;
  /** Customer email from signup form */
  email: string;
  /** Business name — falls back to customer name for solo operators */
  businessName?: string | null;
  /** Location from signup form (free text, e.g. "Melbourne, VIC") */
  location?: string | null;
  /** Phone number if captured */
  phone?: string | null;
  /** Industry if captured at signup (not Rev Seg — that comes later) */
  industry?: string | null;
}

export interface CreateCompanyFromSignupResult {
  companyId: string;
  contactId: string;
  companyName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BetterSQLite3Database<any> | typeof defaultDb;

export function createCompanyFromSignup(
  input: CreateCompanyFromSignupInput,
  dbArg: Db = defaultDb,
): CreateCompanyFromSignupResult {
  const now = Date.now();
  const companyId = randomUUID();
  const contactId = randomUUID();

  const companyName = input.businessName?.trim() || input.name.trim();
  const emailNorm = input.email ? normaliseEmail(input.email) : null;
  const phoneNorm = input.phone ? normalisePhone(input.phone) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    txDb
      .insert(companies)
      .values({
        id: companyId,
        name: companyName,
        name_normalised: normaliseCompanyName(companyName),
        industry: input.industry ?? null,
        location: input.location ?? null,
        billing_mode: "stripe",
        first_seen_at_ms: now,
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();

    txDb
      .insert(contacts)
      .values({
        id: contactId,
        company_id: companyId,
        name: input.name.trim(),
        email: input.email,
        email_normalised: emailNorm,
        phone: input.phone ?? null,
        phone_normalised: phoneNorm,
        is_primary: true,
        relationship_type: "client",
        created_at_ms: now,
        updated_at_ms: now,
      })
      .run();
  });

  return { companyId, contactId, companyName };
}
