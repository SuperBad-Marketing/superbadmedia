import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TemplateSelector } from "./template-selector";

export default async function NewCallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dealId } = await params;
  const deal = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1).then(r => r[0]);
  if (!deal) notFound();

  const company = await db.select().from(companies).where(eq(companies.id, deal.company_id)).limit(1).then(r => r[0]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-8">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--neutral-500)] mb-2"
        >
          New Call
        </div>
        <h1
          className="font-[family-name:var(--font-display)] text-[32px] leading-tight text-[color:var(--neutral-100)]"
        >
          {company?.name ?? "Unknown"}
        </h1>
        <p className="text-[14px] text-[color:var(--neutral-500)] mt-1">
          {deal.title} &middot; {deal.stage.replace("_", " ")}
        </p>
      </div>

      <TemplateSelector dealId={dealId} dealStage={deal.stage} />
    </div>
  );
}
