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
 */
import Anthropic from "@anthropic-ai/sdk";
import { modelFor, modelTierFor, type ModelJobSlug } from "./models";
import { logExternalCall } from "@/lib/observatory/log-external-call";
import { estimateAnthropicCostAud } from "@/lib/observatory/pricing";

const CLIENT_SINGLETON = new Anthropic();

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
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelFor(job),
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
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
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelFor(options.job),
    max_tokens: options.maxTokens,
    ...(options.system ? { system: options.system } : {}),
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

  const response = await CLIENT_SINGLETON.messages.create({
    model: modelFor(job),
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
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
