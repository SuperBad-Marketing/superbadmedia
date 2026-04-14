/**
 * /lite/admin/deals/[id]/quotes/new — creates a draft quote on the deal
 * (or reuses an open one) and redirects to the edit route. No visible UI.
 * Spec: docs/specs/quote-builder.md §4.1.
 */
import { redirect, notFound } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { createDraftQuote } from "@/lib/quote-builder/draft";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }
  const { id: dealId } = await params;
  const deal = await db
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .get();
  if (!deal) notFound();

  const quote = await createDraftQuote({
    deal_id: deal.id,
    company_id: deal.company_id,
    user_id: session.user.id,
  });

  redirect(`/lite/admin/deals/${deal.id}/quotes/${quote.id}/edit`);
}
