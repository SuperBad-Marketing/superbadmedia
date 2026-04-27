import { logExternalCall } from "@/lib/observatory";
import { getCredential } from "@/lib/integrations/getCredential";

const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 12;

export interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  jobName: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  estimatedCostAud?: number;
}

export async function runApifyActor<T>(
  opts: ApifyRunOptions,
): Promise<T[]> {
  const apiToken = await getCredential("apify");
  if (!apiToken) return [];

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollAttempts = opts.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const estimatedCost = opts.estimatedCostAud ?? 0.02;

  try {
    const runId = await startRun(opts.actorId, opts.input, apiToken, timeoutMs);
    const items = await pollForResults<T>(runId, apiToken, pollIntervalMs, maxPollAttempts);

    logExternalCall({
      job: opts.jobName,
      actorType: "internal",
      units: { runs: 1, results_returned: items.length },
      estimatedCostAud: estimatedCost,
    }).catch(() => {});

    return items;
  } catch {
    logExternalCall({
      job: opts.jobName,
      actorType: "internal",
      units: { runs: 1, results_returned: 0 },
      estimatedCostAud: estimatedCost,
    }).catch(() => {});
    return [];
  }
}

async function startRun(
  actorId: string,
  input: Record<string, unknown>,
  apiToken: string,
  timeoutMs: number,
): Promise<string> {
  const url = new URL(`${APIFY_API_BASE}/acts/${actorId}/runs`);
  url.searchParams.set("token", apiToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(input),
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

async function pollForResults<T>(
  runId: string,
  apiToken: string,
  pollIntervalMs: number,
  maxPollAttempts: number,
): Promise<T[]> {
  for (let i = 0; i < maxPollAttempts; i++) {
    await sleep(pollIntervalMs);

    const statusUrl = new URL(`${APIFY_API_BASE}/actor-runs/${runId}`);
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

    return fetchDataset<T>(datasetId, apiToken);
  }

  return [];
}

async function fetchDataset<T>(
  datasetId: string,
  apiToken: string,
): Promise<T[]> {
  const url = new URL(`${APIFY_API_BASE}/datasets/${datasetId}/items`);
  url.searchParams.set("token", apiToken);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "100");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return [];
    return (await response.json()) as T[];
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
