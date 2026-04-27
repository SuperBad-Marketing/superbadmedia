import { logExternalCall } from "@/lib/observatory";
import { getCredential } from "@/lib/integrations/getCredential";

const APIFY_API_BASE = "https://api.apify.com/v2";
const APIFY_TIMEOUT_MS = 30_000;
const APIFY_POLL_INTERVAL_MS = 3_000;
const APIFY_MAX_POLL_ATTEMPTS = 8;

const PREFERRED_ROLES = new Set([
  "founder",
  "ceo",
  "owner",
  "marketing manager",
  "marketing director",
  "growth lead",
  "managing director",
  "director",
]);

export interface ApifyEmailResult {
  email: string | null;
  name: string | null;
  role: string | null;
  confidence: "verified" | "inferred" | "unknown";
  source: "apify";
}

interface ApifyDatasetItem {
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  title?: string;
  domain?: string;
  type?: string;
  confidence?: number | string;
  verified?: boolean;
}

/**
 * Find contact emails for a domain using Apify's email scraper actor.
 * Scrapes the target website + common pages (/about, /contact, /team)
 * to find email addresses, then ranks by role relevance.
 */
export async function findEmailsViaApify(
  domain: string,
  companyName: string,
): Promise<ApifyEmailResult> {
  const apiToken = await getCredential("apify");

  if (!apiToken) {
    return { email: null, name: null, role: null, confidence: "unknown", source: "apify" };
  }

  const startMs = Date.now();
  try {
    const runId = await startActorRun(domain, apiToken);
    const items = await pollForResults(runId, apiToken);

    logExternalCall({
      job: "apify.email_finder",
      actorType: "internal",
      units: { runs: 1, results_returned: items.length },
      estimatedCostAud: 0.05,
    }).catch(() => {});

    if (items.length === 0) {
      return { email: null, name: null, role: null, confidence: "unknown", source: "apify" };
    }

    const best = pickBestContact(items, domain);
    if (!best) {
      return { email: null, name: null, role: null, confidence: "unknown", source: "apify" };
    }

    return {
      email: best.email ?? null,
      name: formatName(best),
      role: best.position ?? best.title ?? null,
      confidence: best.verified ? "verified" : "inferred",
      source: "apify",
    };
  } catch {
    logExternalCall({
      job: "apify.email_finder",
      actorType: "internal",
      units: { runs: 1, results_returned: 0 },
      estimatedCostAud: 0.05,
    }).catch(() => {});
    return { email: null, name: null, role: null, confidence: "unknown", source: "apify" };
  }
}

async function startActorRun(
  domain: string,
  apiToken: string,
): Promise<string> {
  const url = new URL(
    `${APIFY_API_BASE}/acts/apify~contact-info-scraper/runs`,
  );
  url.searchParams.set("token", apiToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        startUrls: [
          { url: `https://${domain}` },
          { url: `https://${domain}/about` },
          { url: `https://${domain}/contact` },
          { url: `https://${domain}/team` },
          { url: `https://${domain}/about-us` },
          { url: `https://${domain}/contact-us` },
        ],
        maxDepth: 1,
        maxPagesPerStartUrl: 3,
        sameDomain: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Apify API ${response.status}`);
    }

    const json = (await response.json()) as { data?: { id?: string } };
    if (!json.data?.id) {
      throw new Error("Apify run did not return an ID");
    }

    return json.data.id;
  } finally {
    clearTimeout(timer);
  }
}

async function pollForResults(
  runId: string,
  apiToken: string,
): Promise<ApifyDatasetItem[]> {
  for (let i = 0; i < APIFY_MAX_POLL_ATTEMPTS; i++) {
    await sleep(APIFY_POLL_INTERVAL_MS);

    const statusUrl = new URL(
      `${APIFY_API_BASE}/actor-runs/${runId}`,
    );
    statusUrl.searchParams.set("token", apiToken);

    const statusRes = await fetch(statusUrl.toString());
    if (!statusRes.ok) continue;

    const statusJson = (await statusRes.json()) as {
      data?: { status?: string; defaultDatasetId?: string };
    };

    const status = statusJson.data?.status;
    if (status === "RUNNING" || status === "READY") continue;
    if (status !== "SUCCEEDED") return [];

    const datasetId = statusJson.data?.defaultDatasetId;
    if (!datasetId) return [];

    return fetchDataset(datasetId, apiToken);
  }

  return [];
}

async function fetchDataset(
  datasetId: string,
  apiToken: string,
): Promise<ApifyDatasetItem[]> {
  const url = new URL(
    `${APIFY_API_BASE}/datasets/${datasetId}/items`,
  );
  url.searchParams.set("token", apiToken);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "50");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APIFY_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return [];
    return (await response.json()) as ApifyDatasetItem[];
  } finally {
    clearTimeout(timer);
  }
}

function pickBestContact(
  items: ApifyDatasetItem[],
  domain: string,
): ApifyDatasetItem | null {
  const withEmail = items.filter(
    (item) => item.email && item.email.includes("@"),
  );

  if (withEmail.length === 0) return null;

  const domainMatches = withEmail.filter((item) => {
    const emailDomain = item.email!.split("@")[1]?.toLowerCase();
    return emailDomain === domain.toLowerCase();
  });

  const pool = domainMatches.length > 0 ? domainMatches : withEmail;

  const generic = new Set(["info", "contact", "hello", "support", "admin", "sales", "enquiries", "enquiry"]);
  const personal = pool.filter((item) => {
    const local = item.email!.split("@")[0]?.toLowerCase();
    return !generic.has(local);
  });

  const candidates = personal.length > 0 ? personal : pool;

  const roleMatches = candidates.filter((item) => {
    const role = (item.position ?? item.title ?? "").toLowerCase();
    return PREFERRED_ROLES.has(role);
  });

  if (roleMatches.length > 0) return roleMatches[0];
  return candidates[0];
}

function formatName(item: ApifyDatasetItem): string | null {
  if (item.name) return item.name;
  const parts = [item.firstName, item.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
