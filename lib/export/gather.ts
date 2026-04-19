/**
 * Query all exportable data for a company.
 * Owner: CM-9. Consumer: generate-zip.
 */
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { quotes } from "@/lib/db/schema/quotes";
import { threads, messages } from "@/lib/db/schema/messages";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { activity_log } from "@/lib/db/schema/activity-log";

export interface CompanyExportData {
  contacts: Array<Record<string, unknown>>;
  deals: Array<Record<string, unknown>>;
  communications: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  actionItems: Array<Record<string, unknown>>;
  brandDnaTags: Array<Record<string, unknown>>;
  brandDnaProfiles: Array<{
    id: string;
    prose_portrait: string | null;
    subject_display_name: string | null;
    signal_tags: string | null;
  }>;
  invoiceIds: string[];
  quoteIds: string[];
}

export async function gatherCompanyData(
  companyId: string,
): Promise<CompanyExportData> {
  const [
    contactRows,
    dealRows,
    invoiceRows,
    quoteRows,
    commRows,
    profileRows,
  ] = await Promise.all([
    db
      .select({
        id: contacts.id,
        name: contacts.name,
        role: contacts.role,
        email: contacts.email,
        phone: contacts.phone,
        is_primary: contacts.is_primary,
        relationship_type: contacts.relationship_type,
        created_at_ms: contacts.created_at_ms,
      })
      .from(contacts)
      .where(eq(contacts.company_id, companyId)),

    db
      .select({
        id: deals.id,
        stage: deals.stage,
        title: deals.title,
        value_cents: deals.value_cents,
        won_outcome: deals.won_outcome,
        loss_reason: deals.loss_reason,
        created_at_ms: deals.created_at_ms,
        updated_at_ms: deals.updated_at_ms,
      })
      .from(deals)
      .where(eq(deals.company_id, companyId)),

    db
      .select({
        id: invoices.id,
        invoice_number: invoices.invoice_number,
        status: invoices.status,
        total_cents_inc_gst: invoices.total_cents_inc_gst,
        total_cents_ex_gst: invoices.total_cents_ex_gst,
        gst_cents: invoices.gst_cents,
        issue_date_ms: invoices.issue_date_ms,
        due_at_ms: invoices.due_at_ms,
        paid_at_ms: invoices.paid_at_ms,
      })
      .from(invoices)
      .where(eq(invoices.company_id, companyId)),

    db
      .select({ id: quotes.id })
      .from(quotes)
      .where(eq(quotes.company_id, companyId)),

    db
      .select({
        id: messages.id,
        channel: messages.channel,
        direction: messages.direction,
        subject: messages.subject,
        created_at_ms: messages.created_at_ms,
      })
      .from(messages)
      .innerJoin(threads, eq(messages.thread_id, threads.id))
      .where(eq(threads.company_id, companyId)),

    db
      .select({
        id: brand_dna_profiles.id,
        prose_portrait: brand_dna_profiles.prose_portrait,
        subject_display_name: brand_dna_profiles.subject_display_name,
        signal_tags: brand_dna_profiles.signal_tags,
        status: brand_dna_profiles.status,
        is_current: brand_dna_profiles.is_current,
        completed_at_ms: brand_dna_profiles.completed_at_ms,
      })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.company_id, companyId)),
  ]);

  const contactIds = contactRows.map((c) => c.id);

  // Brand DNA tags from answers for this company's profiles
  const profileIds = profileRows.map((p) => p.id);
  let tagRows: Array<Record<string, unknown>> = [];
  if (profileIds.length > 0) {
    const allAnswers = await Promise.all(
      profileIds.map((pid) =>
        db
          .select({
            profile_id: brand_dna_answers.profile_id,
            question_id: brand_dna_answers.question_id,
            section: brand_dna_answers.section,
            tags_awarded: brand_dna_answers.tags_awarded,
          })
          .from(brand_dna_answers)
          .where(eq(brand_dna_answers.profile_id, pid)),
      ),
    );
    tagRows = allAnswers.flat();
  }

  // Action items from activity_log (kinds that represent actionable items)
  const actionItemRows = await db
    .select({
      id: activity_log.id,
      kind: activity_log.kind,
      body: activity_log.body,
      created_at_ms: activity_log.created_at_ms,
    })
    .from(activity_log)
    .where(eq(activity_log.company_id, companyId));

  return {
    contacts: contactRows,
    deals: dealRows,
    communications: commRows.map((m) => ({
      id: m.id,
      channel: m.channel,
      direction: m.direction,
      subject: m.subject,
      date: m.created_at_ms,
    })),
    invoices: invoiceRows,
    actionItems: actionItemRows,
    brandDnaTags: tagRows,
    brandDnaProfiles: profileRows,
    invoiceIds: invoiceRows.map((i) => i.id),
    quoteIds: quoteRows.map((q) => q.id),
  };
}
