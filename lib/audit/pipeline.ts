import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals, type DealRow } from "@/lib/db/schema/deals";
import {
  createDealFromLead,
  type CreateDealFromLeadResult,
} from "@/lib/crm/create-deal-from-lead";
import { logActivity } from "@/lib/activity-log";

export interface AuditPipelineInput {
  businessName: string;
  domain: string;
  contactName: string;
  contactEmail: string;
  submissionId: string;
}

export interface AuditPipelineResult {
  dealResult: CreateDealFromLeadResult;
  existingDealReused: boolean;
}

export async function createAuditDeal(
  input: AuditPipelineInput,
): Promise<AuditPipelineResult> {
  const existingCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.domain, input.domain))
    .limit(1);

  let existingDealReused = false;

  if (existingCompanies.length > 0) {
    const company = existingCompanies[0];
    const existingDeals = await db
      .select()
      .from(deals)
      .where(
        and(
          eq(deals.company_id, company.id),
          // Only look for active deals (not lost)
        ),
      )
      .limit(1);

    if (existingDeals.length > 0) {
      existingDealReused = true;
      // Add the new contact to the existing company if not already there
      const existingContacts = await db
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.company_id, company.id),
            eq(contacts.email, input.contactEmail),
          ),
        )
        .limit(1);

      if (existingContacts.length === 0) {
        const contactId = crypto.randomUUID();
        const nowMs = Date.now();
        await db.insert(contacts).values({
          id: contactId,
          company_id: company.id,
          name: input.contactName,
          email: input.contactEmail,
          is_primary: false,
          created_at_ms: nowMs,
          updated_at_ms: nowMs,
        });
      }

      const deal = existingDeals[0];
      const dealResult: CreateDealFromLeadResult = {
        company,
        contact: existingContacts[0] ?? {
          id: crypto.randomUUID(),
          company_id: company.id,
          name: input.contactName,
          email: input.contactEmail,
          is_primary: false,
          created_at_ms: Date.now(),
        } as any,
        deal,
        companyReused: true,
        contactReused: existingContacts.length > 0,
      };

      return { dealResult, existingDealReused };
    }
  }

  const dealResult = createDealFromLead({
    company: {
      name: input.businessName,
      domain: input.domain,
      billing_mode: "stripe",
    },
    contact: {
      name: input.contactName,
      email: input.contactEmail,
    },
    source: "audit_tool",
  });

  await logActivity({
    companyId: dealResult.company.id,
    contactId: dealResult.contact.id,
    dealId: dealResult.deal.id,
    kind: "audit_completed",
    body: `Marketing audit completed for ${input.businessName}`,
    meta: { submission_id: input.submissionId },
  });

  return { dealResult, existingDealReused: false };
}
