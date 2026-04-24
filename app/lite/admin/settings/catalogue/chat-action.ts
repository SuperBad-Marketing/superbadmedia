"use server";

import { auth } from "@/lib/auth/session";
import { invokeLlmText } from "@/lib/ai/invoke";
import { listCatalogueItems } from "@/lib/quote-builder/catalogue";
import { CATALOGUE_ITEM_UNITS } from "@/lib/db/schema/catalogue-items";

export interface CatalogueRecommendation {
  name: string;
  category: string;
  unit: string;
  price_dollars: number;
  description: string;
  rationale: string;
}

export type ChatResponse =
  | { ok: true; message: string; recommendations: CatalogueRecommendation[] }
  | { ok: false; error: string };

export async function catalogueChatAction(
  userMessage: string,
): Promise<ChatResponse> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }

  if (!userMessage.trim()) {
    return { ok: false, error: "Message cannot be empty." };
  }

  const items = listCatalogueItems();
  const catalogueSummary = items.length === 0
    ? "The catalogue is currently empty."
    : items
        .map(
          (it) =>
            `- ${it.name} | ${it.category} | /${it.unit} | $${(it.base_price_cents_inc_gst / 100).toFixed(2)} inc GST${it.description ? ` — ${it.description}` : ""}`,
        )
        .join("\n");

  const system = `You are the pricing assistant for SuperBad Marketing, a Melbourne-based creative agency run by Andy. Your job is to recommend catalogue items (priced deliverables) based on Andy's description of what he wants to offer.

Current catalogue:
${catalogueSummary}

Valid units: ${CATALOGUE_ITEM_UNITS.join(", ")}

Rules:
- All prices are in AUD, GST-inclusive
- Be pragmatic with pricing — SuperBad is a premium boutique agency but not big-agency expensive
- If Andy describes a package or bundle, break it into individual line items
- If items already exist in the catalogue, mention that rather than recommending duplicates
- Categories should be lowercase, short labels (e.g. "retainer", "shoot", "edit", "strategy", "content", "ad management")
- Keep descriptions concise — one sentence max
- Always provide a brief rationale for each pricing recommendation

Respond with valid JSON in this exact format:
{
  "message": "A short conversational response to Andy (1-3 sentences, dry tone)",
  "recommendations": [
    {
      "name": "Item name",
      "category": "category",
      "unit": "project|hour|day|month|piece",
      "price_dollars": 500,
      "description": "Short description",
      "rationale": "Why this price"
    }
  ]
}

If Andy's message is conversational or doesn't warrant new items, return an empty recommendations array with just a message. Always return valid JSON, nothing else.`;

  try {
    const raw = await invokeLlmText({
      job: "catalogue-chat-recommend",
      system,
      prompt: userMessage,
      maxTokens: 2048,
      actorType: "internal",
    });

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(cleaned);
    return {
      ok: true,
      message: parsed.message ?? "",
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
    };
  } catch {
    return { ok: false, error: "Couldn't parse the response. Try again." };
  }
}
