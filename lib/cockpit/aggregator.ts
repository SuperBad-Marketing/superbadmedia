import type { WaitingItem, HealthBanner } from "@/lib/tasks/cockpit";
import { getTaskWaitingItems, getTaskHealthBanners } from "@/lib/tasks/cockpit";
import { getObservatoryHealthBanners } from "@/lib/observatory/health-banners";
import { getSaasHealthBanners } from "@/lib/saas-products/headline-signals";

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
    getInboxHealthBanners(nowMs),
    getContentHealthBanners(nowMs),
    getFinanceHealthBanners(nowMs),
    getWizardHealthBanners(nowMs),
    getHiringHealthBanners(nowMs),
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

// ── Stub sources (return empty until their waves ship) ────────────

async function getQuoteWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getInvoiceWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getSaasWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getInboxWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getLeadGenWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getIntroFunnelWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getContentWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getHiringWaitingItems(_nowMs: number): Promise<WaitingItem[]> {
  return [];
}

async function getInboxHealthBanners(_nowMs: number): Promise<HealthBanner[]> {
  return [];
}

async function getContentHealthBanners(_nowMs: number): Promise<HealthBanner[]> {
  return [];
}

async function getFinanceHealthBanners(_nowMs: number): Promise<HealthBanner[]> {
  return [];
}

async function getWizardHealthBanners(_nowMs: number): Promise<HealthBanner[]> {
  return [];
}

async function getHiringHealthBanners(_nowMs: number): Promise<HealthBanner[]> {
  return [];
}
