import type { WaitingItem, HealthBanner } from "@/lib/tasks/cockpit";
import { getTaskWaitingItems, getTaskHealthBanners } from "@/lib/tasks/cockpit";
import { getObservatoryHealthBanners } from "@/lib/observatory/health-banners";
import { getSaasHealthBanners } from "@/lib/saas-products/headline-signals";
import { getFinanceHealthBanners } from "@/lib/finance/cockpit";
import { getHiringWaitingItems, getHiringHealthBanners } from "@/lib/hiring/cockpit";
import { getQuoteWaitingItems } from "@/lib/quotes/cockpit";
import { getInvoiceWaitingItems } from "@/lib/invoicing/cockpit";
import { getSaasWaitingItems } from "@/lib/saas-products/cockpit-waiting";
import { getInboxWaitingItems } from "@/lib/inbox/cockpit";
import { getInboxHealthBanners } from "@/lib/inbox/health-banners";
import { getLeadGenWaitingItems } from "@/lib/outreach/cockpit";
import { getIntroFunnelWaitingItems } from "@/lib/intro-funnel/cockpit";
import { getContentWaitingItems } from "@/lib/content/cockpit";
import { getContentHealthBanners } from "@/lib/content/health-banners";
import { getBrandDnaWaitingItems } from "@/lib/brand-dna/cockpit";
import { getSixWeekPlanWaitingItems } from "@/lib/six-week-plans/cockpit";
import { getWizardHealthBanners } from "@/lib/wizards/health-banners";

/**
 * Merges waiting items from every source spec in parallel.
 * Sort: time_sensitive first by deadline ASC, then age_of_wait by wait-start ASC, tiebreak on id.
 */
export async function mergeWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const sources = await Promise.allSettled([
    getTaskWaitingItems(nowMs),
    getQuoteWaitingItems(nowMs),
    getInvoiceWaitingItems(nowMs),
    getSaasWaitingItems(nowMs),
    getInboxWaitingItems(nowMs),
    getLeadGenWaitingItems(nowMs),
    getIntroFunnelWaitingItems(nowMs),
    getContentWaitingItems(nowMs),
    getHiringWaitingItems(nowMs),
    getBrandDnaWaitingItems(nowMs),
    getSixWeekPlanWaitingItems(nowMs),
    getClientManagementWaitingItems(nowMs),
    getWizardWaitingItems(nowMs),
  ]);

  const items: WaitingItem[] = [];
  for (const result of sources) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    }
  }

  return sortWaitingItems(items);
}

/**
 * Merges health banners from every source spec in parallel.
 */
export async function mergeHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const sources = await Promise.allSettled([
    getTaskHealthBanners(nowMs),
    getObservatoryHealthBanners(nowMs),
    getSaasHealthBanners("admin"),
    getHiringHealthBanners(nowMs),
    getFinanceHealthBanners(nowMs),
    getInboxHealthBanners(nowMs),
    getContentHealthBanners(nowMs),
    getWizardHealthBanners(nowMs),
  ]);

  const banners: HealthBanner[] = [];
  for (const result of sources) {
    if (result.status === "fulfilled") {
      banners.push(...result.value);
    }
  }

  return banners.sort((a, b) => {
    const sev = severityRank(b.severity) - severityRank(a.severity);
    if (sev !== 0) return sev;
    return a.id.localeCompare(b.id);
  });
}

function severityRank(s: "warning" | "critical"): number {
  return s === "critical" ? 1 : 0;
}

export function sortWaitingItems(items: WaitingItem[]): WaitingItem[] {
  return items.sort((a, b) => {
    if (a.urgency.kind === "time_sensitive" && b.urgency.kind !== "time_sensitive") return -1;
    if (a.urgency.kind !== "time_sensitive" && b.urgency.kind === "time_sensitive") return 1;

    if (a.urgency.kind === "time_sensitive" && b.urgency.kind === "time_sensitive") {
      const diff = a.urgency.value - b.urgency.value;
      if (diff !== 0) return diff;
    }

    if (a.urgency.kind === "age_of_wait" && b.urgency.kind === "age_of_wait") {
      const diff = a.urgency.value - b.urgency.value;
      if (diff !== 0) return diff;
    }

    return a.id.localeCompare(b.id);
  });
}

// ── Stub sources (return empty until their waves ship fully) ─────────

async function getClientManagementWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getWizardWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}
