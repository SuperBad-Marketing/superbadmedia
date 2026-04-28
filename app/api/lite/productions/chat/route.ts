import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth/session";
import { modelFor } from "@/lib/ai/models";
import { logExternalCall } from "@/lib/observatory/log-external-call";
import { estimateAnthropicCostAud } from "@/lib/observatory/pricing";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { productions } from "@/lib/db/schema/productions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const client = new Anthropic();

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function buildSystemPrompt(production: {
  title: string;
  subject_name: string | null;
  subject_type: string | null;
  initial_thought: string | null;
  generated_angles_json: unknown;
  narrative_angle: string | null;
  key_moments_json: unknown;
  voiceover_hook: string | null;
}): string {
  const base = [
    "You are Andy's creative partner for episode development. You're brainstorming",
    "angles, moments, and narrative approaches for a solo-shot observational",
    "docuseries about real businesses.",
    "",
    "The format: 15–20 minute episodes, one camera operator (Andy), handheld +",
    "locked-off tripod shots, observational not presentational. Dry, patient, the",
    "story emerges from the work and the gaps between the work. No host-to-camera",
    "segments. Andy's voice appears sparingly as voiceover — asides, mutters,",
    "observations. Never narration.",
    "",
    "Your job: help find the right angle. Push back on obvious approaches. Suggest",
    "specific moments to look for, structural ideas for the edit, and the kind of",
    "one-liner that could anchor the episode.",
    "",
    "Be concise. Match Andy's voice — dry, direct, no filler. One good idea per",
    "message beats five mediocre ones.",
  ].join("\n");

  const ctx: string[] = [
    "",
    "---",
    `Episode: ${production.title}`,
  ];
  if (production.subject_name) ctx.push(`Subject: ${production.subject_name}`);
  if (production.subject_type) ctx.push(`Type: ${production.subject_type}`);
  if (production.initial_thought)
    ctx.push(`Initial thought: ${production.initial_thought}`);
  if (production.narrative_angle)
    ctx.push(`Locked narrative angle: ${production.narrative_angle}`);
  if (production.voiceover_hook)
    ctx.push(`Voiceover hook: ${production.voiceover_hook}`);

  if (production.generated_angles_json) {
    const angles = production.generated_angles_json as Array<{
      angle: string;
      story: string;
    }>;
    if (angles.length > 0) {
      ctx.push("");
      ctx.push("Auto-generated angles:");
      for (const a of angles) {
        ctx.push(`- ${a.angle}: ${a.story}`);
      }
    }
  }

  if (production.key_moments_json) {
    const moments = production.key_moments_json as string[];
    if (moments.length > 0) {
      ctx.push("");
      ctx.push("Key moments to capture:");
      for (const m of moments) {
        ctx.push(`- ${m}`);
      }
    }
  }

  return base + ctx.join("\n");
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const productionId: string = body.productionId;
  const messages: ChatMessage[] = body.messages ?? [];

  if (!productionId || !messages.length) {
    return Response.json(
      { error: "Missing productionId or messages" },
      { status: 400 },
    );
  }

  const [production] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, productionId))
    .limit(1);

  if (!production) {
    return Response.json({ error: "Production not found" }, { status: 404 });
  }

  const modelId = modelFor("productions-brainstorm");
  const system = buildSystemPrompt(production);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(
            `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
          ),
        );
      }

      try {
        const anthropicMessages: Anthropic.MessageParam[] = messages.map(
          (m) => ({ role: m.role, content: m.content }),
        );

        const response = await client.messages.create({
          model: modelId,
          max_tokens: 1024,
          system,
          messages: anthropicMessages,
          stream: true,
        });

        let totalInput = 0;
        let totalOutput = 0;
        let fullText = "";

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            fullText += event.delta.text;
            send("text_delta", { content: event.delta.text });
          }
          if (event.type === "message_delta") {
            totalOutput += event.usage?.output_tokens ?? 0;
          }
          if (event.type === "message_start") {
            totalInput += event.message.usage?.input_tokens ?? 0;
          }
        }

        send("text_done", { content: fullText });

        logExternalCall({
          job: "productions-brainstorm",
          actorType: "internal",
          actorId: session.user.id ?? "admin",
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
