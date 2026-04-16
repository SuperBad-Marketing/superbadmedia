/**
 * Single entry point for Anthropic `messages.create` calls from feature
 * code. Feature code names the job; the registry resolves the model.
 * Keeps `@anthropic-ai/sdk` imports behind the `lib/ai/` boundary per
 * FOUNDATIONS §11.6 + memory `project_llm_model_registry`, enforced by
 * the `lite/no-direct-anthropic-import` ESLint rule.
 */
import Anthropic from "@anthropic-ai/sdk";
import { modelFor, type ModelJobSlug } from "./models";

const CLIENT_SINGLETON = new Anthropic();

export interface InvokeLlmTextOptions {
  job: ModelJobSlug;
  prompt: string;
  maxTokens: number;
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
  maxTokens,
}: InvokeLlmTextOptions): Promise<string> {
  const response = await CLIENT_SINGLETON.messages.create({
    model: modelFor(job),
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return response.content.find((b) => b.type === "text")?.text?.trim() ?? "";
}
