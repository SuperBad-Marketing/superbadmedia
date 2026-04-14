import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as defaultDb } from "@/lib/db";
import {
  companies,
  type CompanyRow,
  type CompanyInsert,
  type CompanyBillingMode,
  type CompanyShape,
  type CompanySizeBand,
} from "@/lib/db/schema/companies";
import {
  contacts,
  type ContactRow,
  type ContactInsert,
} from "@/lib/db/schema/contacts";
import {
  deals,
  type DealRow,
  type DealStage,
  DEAL_STAGES,
} from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  normaliseEmail,
  normalisePhone,
  normaliseCompanyName,
  normaliseDomain,
} from "./normalise";

/**
 * Maps ingress sources to the stage a new deal should land in. Omission
 * means default (`lead`). Extend sparingly — new sources usually start at
 * `lead` and advance through normal auto-transitions.
 */
const SOURCE_STAGE_OVERRIDES: Record<string, DealStage> = {
  intro_funnel_contact_submitted: "trial_shoot",
  intro_funnel_paid: "trial_shoot",
};

export interface CreateDealCompanyInput {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size_band?: CompanySizeBand | null;
  billing_mode?: CompanyBillingMode;
  shape?: CompanyShape | null;
  notes?: string | null;
}

export interface CreateDealContactInput {
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface CreateDealFromLeadInput {
  company: CreateDealCompanyInput;
  contact: CreateDealContactInput;
  /** Free-form source tag. Some values (see SOURCE_STAGE_OVERRIDES) land
   *  the deal in a non-default stage. */
  source: string;
  /** Human label for the deal. Defaults to "New lead — <company.name>". */
  title?: string;
  /** Override the default starting stage (usually `lead`). */
  stage?: DealStage;
  /** Override now() — test harness. */
  nowMs?: number;
}

export interface CreateDealFromLeadResult {
  company: CompanyRow;
  contact: ContactRow;
  deal: DealRow;
  /** True when this call reused an existing company row (dedupe hit). */
  companyReused: boolean;
  /** True when this call reused an existing contact row (dedupe hit). */
  contactReused: boolean;
}

type Db = BetterSQLite3Database<Record<string, unknown>> | typeof defaultDb;

/**
 * Non-destructive merge: only overwrites existing fields when the target
 * is null/undefined AND the incoming value is meaningfully populated.
 * Never blanks a field that already has a value.
 */
function mergeContactFields(
  existing: ContactRow,
  incoming: CreateDealContactInput,
  nowMs: number,
): Partial<ContactInsert> | null {
  const patch: Partial<ContactInsert> = {};
  let dirty = false;
  const emailNorm = normaliseEmail(incoming.email);
  const phoneNorm = normalisePhone(incoming.phone);

  if (existing.name === "" && incoming.name) {
    patch.name = incoming.name;
    dirty = true;
  }
  if (!existing.role && incoming.role) {
    patch.role = incoming.role;
    dirty = true;
  }
  if (!existing.email && emailNorm) {
    patch.email = incoming.email ?? null;
    patch.email_normalised = emailNorm;
    dirty = true;
  }
  if (!existing.phone && phoneNorm) {
    patch.phone = incoming.phone ?? null;
    patch.phone_normalised = phoneNorm;
    dirty = true;
  }
  if (!existing.notes && incoming.notes) {
    patch.notes = incoming.notes;
    dirty = true;
  }
  if (dirty) {
    patch.updated_at_ms = nowMs;
    return patch;
  }
  return null;
}

function mergeCompanyFields(
  existing: CompanyRow,
  incoming: CreateDealCompanyInput,
  nowMs: number,
): Partial<CompanyInsert> | null {
  const patch: Partial<CompanyInsert> = {};
  let dirty = false;
  if (!existing.domain && incoming.domain) {
    patch.domain = normaliseDomain(incoming.domain);
    dirty = true;
  }
  if (!existing.industry && incoming.industry) {
    patch.industry = incoming.industry;
    dirty = true;
  }
  if (!existing.size_band && incoming.size_band) {
    patch.size_band = incoming.size_band;
    dirty = true;
  }
  if (!existing.shape && incoming.shape) {
    patch.shape = incoming.shape;
    dirty = true;
  }
  if (!existing.notes && incoming.notes) {
    patch.notes = incoming.notes;
    dirty = true;
  }
  if (dirty) {
    patch.updated_at_ms = nowMs;
    return patch;
  }
  return null;
}

/**
 * Lookup-or-create a Company + Contact, then create a new Deal.
 *
 * Contact dedupe: match existing contact on normalised email first,
 * normalised phone as fallback. Company dedupe: normalised name +
 * (when present) normalised domain.
 *
 * Runs in a single synchronous transaction so the `activity_log` row is
 * always consistent with the deal row.
 */
export function createDealFromLead(
  input: CreateDealFromLeadInput,
  dbArg: Db = defaultDb,
): CreateDealFromLeadResult {
  const nowMs = input.nowMs ?? Date.now();
  const emailNorm = normaliseEmail(input.contact.email);
  const phoneNorm = normalisePhone(input.contact.phone);
  const companyNameNorm = normaliseCompanyName(input.company.name);
  const companyDomainNorm = normaliseDomain(input.company.domain);

  if (!companyNameNorm) {
    throw new Error("createDealFromLead: company.name is required");
  }
  if (!input.contact.name.trim()) {
    throw new Error("createDealFromLead: contact.name is required");
  }

  const stage: DealStage =
    input.stage ??
    SOURCE_STAGE_OVERRIDES[input.source] ??
    ("lead" as DealStage);
  if (!DEAL_STAGES.includes(stage)) {
    throw new Error(`createDealFromLead: unknown stage '${stage}'`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const database = dbArg as any;

  return database.transaction((tx: Db) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txDb = tx as any;

    // ── Resolve or create company ─────────────────────────────────────
    let companyRow: CompanyRow | undefined;
    let companyReused = false;

    const companyByName: CompanyRow[] = txDb
      .select()
      .from(companies)
      .where(eq(companies.name_normalised, companyNameNorm))
      .all();

    if (companyByName.length > 0) {
      if (companyDomainNorm) {
        companyRow =
          companyByName.find((c: CompanyRow) => c.domain === companyDomainNorm) ??
          companyByName[0];
      } else {
        companyRow = companyByName[0];
      }
      companyReused = true;
      const patch = mergeCompanyFields(companyRow, input.company, nowMs);
      if (patch) {
        txDb
          .update(companies)
          .set(patch)
          .where(eq(companies.id, companyRow.id))
          .run();
        companyRow = { ...companyRow, ...patch } as CompanyRow;
      }
    } else {
      const id = randomUUID();
      const insert: CompanyInsert = {
        id,
        name: input.company.name,
        name_normalised: companyNameNorm,
        domain: companyDomainNorm ?? null,
        industry: input.company.industry ?? null,
        size_band: input.company.size_band ?? null,
        billing_mode: input.company.billing_mode ?? "stripe",
        do_not_contact: false,
        notes: input.company.notes ?? null,
        trial_shoot_status: "none",
        shape: input.company.shape ?? null,
        first_seen_at_ms: nowMs,
        created_at_ms: nowMs,
        updated_at_ms: nowMs,
      };
      txDb.insert(companies).values(insert).run();
      companyRow = txDb
        .select()
        .from(companies)
        .where(eq(companies.id, id))
        .get();
    }

    if (!companyRow) {
      throw new Error("createDealFromLead: failed to resolve company row");
    }

    // ── Resolve or create contact ─────────────────────────────────────
    let contactRow: ContactRow | undefined;
    let contactReused = false;

    if (emailNorm) {
      contactRow = txDb
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.company_id, companyRow.id),
            eq(contacts.email_normalised, emailNorm),
          ),
        )
        .get();
    }
    if (!contactRow && phoneNorm) {
      contactRow = txDb
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.company_id, companyRow.id),
            eq(contacts.phone_normalised, phoneNorm),
          ),
        )
        .get();
    }

    if (contactRow) {
      contactReused = true;
      const patch = mergeContactFields(contactRow, input.contact, nowMs);
      if (patch) {
        txDb
          .update(contacts)
          .set(patch)
          .where(eq(contacts.id, contactRow.id))
          .run();
        contactRow = { ...contactRow, ...patch } as ContactRow;
      }
    } else {
      const id = randomUUID();
      const insert: ContactInsert = {
        id,
        company_id: companyRow.id,
        name: input.contact.name,
        role: input.contact.role ?? null,
        email: input.contact.email ?? null,
        email_normalised: emailNorm,
        email_status: "unknown",
        phone: input.contact.phone ?? null,
        phone_normalised: phoneNorm,
        is_primary: false,
        notes: input.contact.notes ?? null,
        stripe_customer_id: null,
        created_at_ms: nowMs,
        updated_at_ms: nowMs,
      };
      txDb.insert(contacts).values(insert).run();
      contactRow = txDb
        .select()
        .from(contacts)
        .where(eq(contacts.id, id))
        .get();
    }

    if (!contactRow) {
      throw new Error("createDealFromLead: failed to resolve contact row");
    }

    // ── Create deal ───────────────────────────────────────────────────
    const dealId = randomUUID();
    const title = input.title ?? `New lead — ${companyRow.name}`;
    const dealInsert = {
      id: dealId,
      company_id: companyRow.id,
      primary_contact_id: contactRow.id,
      title,
      stage,
      value_estimated: true,
      pause_used_this_commitment: false,
      last_stage_change_at_ms: nowMs,
      source: input.source,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    } satisfies Omit<typeof deals.$inferInsert, never>;

    txDb.insert(deals).values(dealInsert).run();
    const dealRow: DealRow = txDb
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();

    txDb
      .insert(activity_log)
      .values({
        id: randomUUID(),
        company_id: companyRow.id,
        contact_id: contactRow.id,
        deal_id: dealId,
        kind: "stage_change",
        body: `Deal opened at '${stage}' from source '${input.source}'.`,
        meta: {
          from_stage: null,
          to_stage: stage,
          source: input.source,
          company_reused: companyReused,
          contact_reused: contactReused,
        },
        created_at_ms: nowMs,
        created_by: null,
      })
      .run();

    return {
      company: companyRow,
      contact: contactRow,
      deal: dealRow,
      companyReused,
      contactReused,
    };
  });
}
