import { getCredential } from "@/lib/integrations/getCredential";
import { HIGGSFIELD_API_BASE } from "@/lib/integrations/vendors/higgsfield";

export interface HiggsFieldSubmitInput {
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  model?: string;
}

export interface HiggsFieldSubmitResult {
  jobId: string;
  status: "queued" | "processing";
}

export interface HiggsFieldStatusResult {
  status: "queued" | "processing" | "completed" | "failed";
  outputUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  creditsUsed?: number;
  modelUsed?: string;
}

async function getApiKey(): Promise<string> {
  const key = await getCredential("higgsfield");
  if (!key) {
    throw new Error("Higgsfield not connected — set up via Settings → Integrations.");
  }
  return key;
}

function getBaseUrl(): string {
  return process.env.HIGGSFIELD_API_URL ?? HIGGSFIELD_API_BASE;
}

export async function submitVideoJob(
  input: HiggsFieldSubmitInput,
): Promise<HiggsFieldSubmitResult> {
  const apiKey = await getApiKey();

  const res = await fetch(`${getBaseUrl()}/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? "16:9",
      duration: input.duration ?? 5,
      model: input.model ?? "seedance-2.0",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`Higgsfield API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { id?: string; status?: string };
  if (!data.id) throw new Error("Higgsfield response missing job ID");

  return {
    jobId: data.id,
    status: (data.status as "queued" | "processing") ?? "queued",
  };
}

export async function getVideoJobStatus(
  jobId: string,
): Promise<HiggsFieldStatusResult> {
  const apiKey = await getApiKey();

  const res = await fetch(`${getBaseUrl()}/generations/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Higgsfield status check failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    status?: string;
    output_url?: string;
    thumbnail_url?: string;
    error?: string;
    credits_used?: number;
    model?: string;
  };

  return {
    status: (data.status as HiggsFieldStatusResult["status"]) ?? "queued",
    outputUrl: data.output_url,
    thumbnailUrl: data.thumbnail_url,
    error: data.error,
    creditsUsed: data.credits_used,
    modelUsed: data.model,
  };
}
