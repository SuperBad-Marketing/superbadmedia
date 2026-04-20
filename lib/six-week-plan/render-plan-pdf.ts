import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { six_week_plans } from "@/lib/db/schema/six-week-plans";
import { deals } from "@/lib/db/schema/deals";
import { companies } from "@/lib/db/schema/companies";
import { renderToPdf } from "@/lib/pdf/render";
import { buildPlanPdfHtml, planPdfFilename } from "./pdf-template";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";
import type { WeeksOutput } from "@/lib/ai/prompts/six-week-plan/weeks";

export interface RenderedPlanPdf {
  buffer: Buffer;
  filename: string;
  generationVersion: number;
}

const pdfCache = new Map<string, { buffer: Buffer; filename: string; generationVersion: number; cachedAtMs: number }>();
const MS_PER_HOUR = 60 * 60 * 1000;

export async function renderPlanPdf(
  planId: string,
  contactId?: string,
  opts?: { skipCache?: boolean },
): Promise<RenderedPlanPdf | null> {
  const plan = await db.query.six_week_plans.findFirst({
    where: eq(six_week_plans.id, planId),
  });
  if (!plan) return null;
  if (!["approved", "released"].includes(plan.status)) return null;

  const cacheKey = `${planId}:${plan.generation_version}`;
  const cached = pdfCache.get(cacheKey);
  const cacheTtlHours = await settings.get("plan.pdf_cache_hours");
  const cacheTtlMs = cacheTtlHours * MS_PER_HOUR;
  if (!opts?.skipCache && cached && Date.now() - cached.cachedAtMs < cacheTtlMs) {
    if (contactId) {
      void logPdfDownload(plan.deal_id, contactId, planId, plan.generation_version);
    }
    return { buffer: cached.buffer, filename: cached.filename, generationVersion: cached.generationVersion };
  }

  const deal = await db.query.deals.findFirst({
    where: eq(deals.id, plan.deal_id),
  });
  if (!deal) return null;

  const company = deal.company_id
    ? await db.query.companies.findFirst({
        where: eq(companies.id, deal.company_id),
      })
    : null;

  const businessName = company?.name ?? deal.title;
  const weeksData = plan.weeks_json as unknown as WeeksOutput | null;
  if (!weeksData?.weeks?.length) return null;

  const html = buildPlanPdfHtml({
    businessName,
    planIntro: weeksData.plan_intro,
    weeks: weeksData.weeks,
    approvedAtMs: plan.approved_at_ms ?? plan.created_at_ms,
  });

  const buffer = await renderToPdf(html, {
    format: "A4",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    printBackground: true,
  });

  const filename = planPdfFilename(
    businessName,
    plan.approved_at_ms ?? plan.created_at_ms,
  );

  for (const [key, entry] of pdfCache) {
    if (key.startsWith(`${planId}:`) && key !== cacheKey) {
      pdfCache.delete(key);
    }
  }

  pdfCache.set(cacheKey, {
    buffer,
    filename,
    generationVersion: plan.generation_version,
    cachedAtMs: Date.now(),
  });

  if (contactId) {
    void logPdfDownload(plan.deal_id, contactId, planId, plan.generation_version);
  }

  return { buffer, filename, generationVersion: plan.generation_version };
}

async function logPdfDownload(
  dealId: string,
  contactId: string,
  planId: string,
  generationVersion: number,
) {
  await logActivity({
    dealId,
    contactId,
    kind: "six_week_plan_pdf_downloaded",
    body: "Prospect downloaded the six-week plan PDF.",
    meta: { plan_id: planId, generation_version: generationVersion },
  });
}
