/**
 * Single entry point for Anthropic `messages.create` calls from feature
 * code. Feature code names the job; the registry resolves the model.
 * Keeps `@anthropic-ai/sdk` imports behind the `lib/ai/` boundary per
 * FOUNDATIONS §11.6 + memory `project_llm_model_registry`, enforced by
 * the `lite/no-direct-anthropic-import` ESLint rule.
 *
 * Every call logs a cost tuple to `external_call_log` via the observatory
 * helper (COB-1, Wave 21). Logging is fire-and-forget — never blocks the
 * response or throws on insert failure.
 *
 * API key resolution: wizard-stored key (integration_connections) wins,
 * env var ANTHROPIC_API_KEY is the fallback for local dev.
 */
import Anthropic from "@anthropic-ai/sdk";
import { eq, and } from "drizzle-orm";
import { modelFor, modelTierFor, isProfileInjectionExcluded, type ModelJobSlug } from "./models";
import { logExternalCall } from "@/lib/observatory/log-external-call";
import { estimateAnthropicCostAud } from "@/lib/observatory/pricing";
import { db } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { vault } from "@/lib/crypto/vault";
import { loadSuperBadContext } from "@/lib/business-profile/load-context";
import settingsRegistry from "@/lib/settings";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedKey: string | null = null;
let cachedClient: Anthropic | null = null;
let cacheExpiresAt = 0;

async function getClient(): Promise<Anthropic> {
  const now = Date.now();
  if (cachedClient && now < cacheExpiresAt) return cachedClient;

  let apiKey: string | undefined;

  try {
    const row = await db
      .select({ credentials: integration_connections.credentials })
      .from(integration_connections)
      .where(
        and(
          eq(integration_connections.vendor_key, "anthropic"),
          eq(integration_connections.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (row) {
      apiKey = vault.decrypt(row.credentials, "anthropic.credentials");
    }
  } catch {
    // DB or vault unavailable — fall through to env var
  }

  if (!apiKey) {
    apiKey = process.env.ANTHROPIC_API_KEY;
  }

  if (apiKey !== cachedKey || !cachedClient) {
    cachedClient = new Anthropic({ apiKey });
    cachedKey = apiKey ?? null;
  }
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedClient;
}

function safeUsage(response: { usage?: { input_tokens?: number; output_tokens?: number } }): {
  inputTokens: number;
  outputTokens: number;
} {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

function logCost(
  job: ModelJobSlug,
  usage: { inputTokens: number; outputTokens: number },
  actorType: "internal" | "external" | "shared" | "prospect",
  actorId?: string | null,
): void {
  if (usage.inputTokens === 0 && usage.outputTokens === 0) return;
  logExternalCall({
    job,
    actorType,
    actorId: actorId ?? null,
    units: usage,
    estimatedCostAud: estimateAnthropicCostAud(modelTierFor(job), usage),
  }).catch(() => {});
}

async function resolveSystemWithProfile(
  job: ModelJobSlug,
  callerSystem: string | undefined,
): Promise<string | undefined> {
  if (isProfileInjectionExcluded(job)) return callerSystem;

  let enforced = true;
  try {
    enforced = await settingsRegistry.get("profile.enforcement_enabled");
  } catch {
    // settings row missing — treat as enabled
  }
  if (!enforced) return callerSystem;

  const tier = modelTierFor(job);
  const profileContext = await loadSuperBadContext(tier);
  if (!profileContext) return callerSystem;

  if (callerSystem) {
    return `${profileContext}\n\n${callerSystem}`;
  }
  return profileContext;
}

export interface InvokeLlmTextOptions {
  job: ModelJobSlug;
  prompt: string;
  /** Optional system message — used when Brand DNA or other context must be
   *  separated from the user prompt (discipline #44). */
  system?: string;
  maxTokens: number;
  /** Actor attribution for cost logging (spec §4.1). */
  actorType?: "internal" | "external" | "shared" | "prospect";
  actorId?: string | null;
}

/**
 * Runs a single user-message completion and returns the trimmed text of
 * the first text block. Callers handle JSON/zod parsing themselves —
 * this helper exists to centralise the SDK boundary, not to dictate
 * response shape.
 */
export async function invokeLlmText({
  job,
  prompt,
  system,
  maxTokens,
  actorType = "internal",
  actorId,
}: InvokeLlmTextOptions): Promise<string> {
  const client = await getClient();
  const resolvedSystem = await resolveSystemWithProfile(job, system);
  const response = await client.messages.create({
    model: modelFor(job),
    max_tokens: maxTokens,
    ...(resolvedSystem ? { system: resolvedSystem } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  const usage = safeUsage(response);
  logCost(job, usage, actorType, actorId);
  return response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}

export interface InvokeLlmResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export async function invokeLlmTextWithMeta(
  options: InvokeLlmTextOptions,
): Promise<InvokeLlmResult> {
  const client = await getClient();
  const resolvedSystem = await resolveSystemWithProfile(options.job, options.system);
  const response = await client.messages.create({
    model: modelFor(options.job),
    max_tokens: options.maxTokens,
    ...(resolvedSystem ? { system: resolvedSystem } : {}),
    messages: [{ role: "user", content: options.prompt }],
  });
  const usage = safeUsage(response);
  logCost(options.job, usage, options.actorType ?? "internal", options.actorId);
  return {
    text: response.content.find((b) => b.type === "text")?.text?.trim() ?? "",
    ...usage,
  };
}

export interface InvokeLlmVisionOptions {
  job: ModelJobSlug;
  prompt: string;
  imageUrls: string[];
  system?: string;
  maxTokens: number;
  actorType?: "internal" | "external" | "shared" | "prospect";
  actorId?: string | null;
}

export async function invokeLlmVision({
  job,
  prompt,
  imageUrls,
  system,
  maxTokens,
  actorType = "internal",
  actorId,
}: InvokeLlmVisionOptions): Promise<InvokeLlmResult> {
  const imageBlocks: Anthropic.ImageBlockParam[] = imageUrls.map((url) => ({
    type: "image" as const,
    source: { type: "url" as const, url },
  }));

  const client = await getClient();
  const resolvedSystem = await resolveSystemWithProfile(job, system);
  const response = await client.messages.create({
    model: modelFor(job),
    max_tokens: maxTokens,
    ...(resolvedSystem ? { system: resolvedSystem } : {}),
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text" as const, text: prompt },
        ],
      },
    ],
  });

  const usage = safeUsage(response);
  logCost(job, usage, actorType, actorId);
  return {
    text: response.content.find((b) => b.type === "text")?.text?.trim() ?? "",
    ...usage,
  };
}
