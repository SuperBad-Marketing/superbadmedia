import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth/session";
import { modelFor } from "@/lib/ai/models";
import { logExternalCall } from "@/lib/observatory/log-external-call";
import { estimateAnthropicCostAud } from "@/lib/observatory/pricing";
import { COCKPIT_TOOLS } from "@/lib/ai/cockpit-assistant/tools";
import { handleToolCall } from "@/lib/ai/cockpit-assistant/handlers";
import { buildCockpitSystemPrompt } from "@/lib/ai/cockpit-assistant/system-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const messages: ChatMessage[] = body.messages ?? [];
  const userId = session.user.id ?? "admin";

  if (!messages.length) {
    return Response.json(
      { error: "No messages provided" },
      { status: 400 },
    );
  }

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const modelId = modelFor("cockpit-assistant");
  const system = buildCockpitSystemPrompt(today);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      try {
        let totalInput = 0;
        let totalOutput = 0;

        // Build Anthropic messages from chat history
        const anthropicMessages: Anthropic.MessageParam[] = messages.map(
          (m) => ({ role: m.role, content: m.content }),
        );

        // Tool-use loop — keep going until Claude responds with text only
        const MAX_TOOL_ROUNDS = 8;
        let round = 0;

        while (round < MAX_TOOL_ROUNDS) {
          round++;

          const response = await client.messages.create({
            model: modelId,
            max_tokens: 1024,
            system,
            tools: COCKPIT_TOOLS,
            messages: anthropicMessages,
          });

          totalInput += response.usage?.input_tokens ?? 0;
          totalOutput += response.usage?.output_tokens ?? 0;

          // Check if there are tool calls
          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          const textBlocks = response.content.filter(
            (b): b is Anthropic.TextBlock => b.type === "text",
          );

          if (toolBlocks.length === 0) {
            // No tool calls — stream the final text
            const finalText = textBlocks.map((b) => b.text).join("");
            send("text", { content: finalText });
            break;
          }

          // Tool calls — execute them and continue
          for (const tool of toolBlocks) {
            send("tool_call", { name: tool.name });
          }

          // Add assistant's response (with tool use blocks) to messages
          anthropicMessages.push({ role: "assistant", content: response.content });

          // Execute tools and build result message
          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tool of toolBlocks) {
            const result = await handleToolCall(
              tool.name,
              tool.input as Record<string, unknown>,
              userId,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: result.result,
            });
          }

          anthropicMessages.push({ role: "user", content: toolResults });
        }

        // Log cost
        logExternalCall({
          job: "cockpit-assistant",
          actorType: "internal",
          actorId: userId,
          units: { inputTokens: totalInput, outputTokens: totalOutput },
          estimatedCostAud: estimateAnthropicCostAud("sonnet", {
            inputTokens: totalInput,
            outputTokens: totalOutput,
          }),
        }).catch(() => {});

        send("done", {});
      } catch (err) {
        send("error", {
          message:
            err instanceof Error ? err.message : "Something went wrong.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
