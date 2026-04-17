/**
 * Do Not Contact enforcement — the ONLY read path for DNC rules (§12.J).
 *
 * `isBlockedFromOutreach(email, companyId?)` is called from exactly three
 * places:
 *   1. Daily search dedup step
 *   2. Draft generator pre-render
 *   3. Send step (immediately before `sendEmail()`)
 *
 * No other code path reads `dnc_emails`, `dnc_domains`, or
 * `companies.do_not_contact` directly.
 *
 * Owner: Lead Generation spec §12.
 */

import { eq } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { dncEmails } from "@/lib/db/schema/dnc";
import { dncDomains } from "@/lib/db/schema/dnc";
import { companies } from "@/lib/db/schema/companies";

export type BlockReason = "company" | "email" | "domain";

export interface BlockCheckResult {
  blocked: boolean;
  reason: BlockReason | null;
}

/**
 * Extract domain from an email address. Returns null for invalid inputs.
 */
function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  return email.slice(at + 1).toLowerCase().trim();
}

/**
 * Normalise an email address for comparison: lowercase + trim.
 * §12.K — all DNC writes and reads normalise consistently.
 */
function normaliseEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Check whether an email (and optionally its company) is blocked from
 * outreach. This is the ONLY function that interprets DNC rules.
 *
 * Check order: company → email → domain. First match wins.
 */
export async function isBlockedFromOutreach(
  email: string,
  companyId?: string,
  dbInstance = defaultDb,
): Promise<BlockCheckResult> {
  // 1. Company-level block
  if (companyId) {
    const company = await dbInstance
      .select({ do_not_contact: companies.do_not_contact })
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();

    if (company?.do_not_contact) {
      return { blocked: true, reason: "company" };
    }
  }

  const normEmail = normaliseEmail(email);

  // 2. Email-level block
  const emailBlock = await dbInstance
    .select({ id: dncEmails.id })
    .from(dncEmails)
    .where(eq(dncEmails.email, normEmail))
    .get();

  if (emailBlock) {
    return { blocked: true, reason: "email" };
  }

  // 3. Domain-level block
  const domain = extractDomain(normEmail);
  if (domain) {
    const domainBlock = await dbInstance
      .select({ id: dncDomains.id })
      .from(dncDomains)
      .where(eq(dncDomains.domain, domain))
      .get();

    if (domainBlock) {
      return { blocked: true, reason: "domain" };
    }
  }

  return { blocked: false, reason: null };
}

/**
 * Add an email to the DNC list. Normalises per §12.K.
 * Returns false if the email is already blocked (idempotent).
 */
export async function addDncEmail(
  email: string,
  source: "unsubscribe_link" | "manual" | "csv_import" | "complaint",
  opts: { reason?: string; addedBy?: string; db?: typeof defaultDb } = {},
): Promise<boolean> {
  const dbInstance = opts.db ?? defaultDb;
  const normEmail = normaliseEmail(email);

  try {
    await dbInstance.insert(dncEmails).values({
      id: crypto.randomUUID(),
      email: normEmail,
      reason: opts.reason ?? null,
      source,
      added_by: opts.addedBy ?? null,
      added_at: new Date(),
    });
    return true;
  } catch (err: unknown) {
    // UNIQUE constraint = already blocked
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Add a domain to the DNC list. Normalises per §12.K.
 * Returns false if the domain is already blocked (idempotent).
 */
export async function addDncDomain(
  domain: string,
  addedBy: string,
  opts: { reason?: string; db?: typeof defaultDb } = {},
): Promise<boolean> {
  const dbInstance = opts.db ?? defaultDb;
  const normDomain = domain.toLowerCase().trim().replace(/^@/, "");

  try {
    await dbInstance.insert(dncDomains).values({
      id: crypto.randomUUID(),
      domain: normDomain,
      reason: opts.reason ?? null,
      added_by: addedBy,
      added_at: new Date(),
    });
    return true;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      err.message.includes("UNIQUE constraint failed")
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Remove an email from the DNC list. Returns true if found and removed.
 */
export async function removeDncEmail(
  email: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const normEmail = normaliseEmail(email);
  const result = await dbInstance
    .delete(dncEmails)
    .where(eq(dncEmails.email, normEmail));
  return result.changes > 0;
}

/**
 * Remove a domain from the DNC list. Returns true if found and removed.
 */
export async function removeDncDomain(
  domain: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const normDomain = domain.toLowerCase().trim().replace(/^@/, "");
  const result = await dbInstance
    .delete(dncDomains)
    .where(eq(dncDomains.domain, normDomain));
  return result.changes > 0;
}
