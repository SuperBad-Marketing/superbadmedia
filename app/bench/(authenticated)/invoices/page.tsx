import { redirect } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contractor_invoices } from "@/lib/db/schema/contractor-invoices";
import { getBenchSession } from "@/lib/bench/guard";
import { InvoicesSurface } from "@/components/lite/bench/invoices-surface";

export const metadata = {
  title: "SuperBad — Invoices",
};

export default async function BenchInvoicesPage() {
  const session = await getBenchSession();
  if (!session) redirect("/bench/expired");

  const invoices = db
    .select({
      id: contractor_invoices.id,
      amount_aud: contractor_invoices.amount_aud,
      reference: contractor_invoices.reference,
      notes: contractor_invoices.notes,
      status: contractor_invoices.status,
      submitted_at_ms: contractor_invoices.submitted_at_ms,
    })
    .from(contractor_invoices)
    .where(eq(contractor_invoices.candidate_id, session.candidateId))
    .orderBy(desc(contractor_invoices.submitted_at_ms))
    .all();

  return <InvoicesSurface invoices={invoices} />;
}
