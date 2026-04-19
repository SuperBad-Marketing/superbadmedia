import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { intro_funnel_submissions } from "@/lib/db/schema/intro-funnel-submissions";
import { intro_funnel_payments } from "@/lib/db/schema/intro-funnel-payments";
import { intro_funnel_bookings } from "@/lib/db/schema/intro-funnel-bookings";
import { intro_funnel_reflections } from "@/lib/db/schema/intro-funnel-reflections";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";

export async function loadSubmissionByToken(token: string) {
  const rows = await db
    .select()
    .from(intro_funnel_submissions)
    .where(eq(intro_funnel_submissions.token, token))
    .limit(1);

  if (rows.length === 0) return null;
  const submission = rows[0];

  const [contactRows, dealRows] = await Promise.all([
    db
      .select()
      .from(contacts)
      .where(eq(contacts.id, submission.contact_id))
      .limit(1),
    db
      .select()
      .from(deals)
      .where(eq(deals.id, submission.deal_id))
      .limit(1),
  ]);

  const contact = contactRows[0] ?? null;
  const deal = dealRows[0] ?? null;

  let company = null;
  if (deal) {
    const companyRows = await db
      .select()
      .from(companies)
      .where(eq(companies.id, deal.company_id))
      .limit(1);
    company = companyRows[0] ?? null;
  }

  const paymentRows = await db
    .select()
    .from(intro_funnel_payments)
    .where(eq(intro_funnel_payments.submission_id, submission.id))
    .limit(1);
  const payment = paymentRows[0] ?? null;

  const bookingRows = await db
    .select()
    .from(intro_funnel_bookings)
    .where(eq(intro_funnel_bookings.submission_id, submission.id))
    .limit(1);
  const booking = bookingRows[0] ?? null;

  const reflectionRows = await db
    .select()
    .from(intro_funnel_reflections)
    .where(eq(intro_funnel_reflections.submission_id, submission.id))
    .limit(1);
  const reflection = reflectionRows[0] ?? null;

  return { submission, contact, deal, company, payment, booking, reflection };
}
