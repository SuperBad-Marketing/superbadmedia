import { NextRequest, NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal/guard";
import {
  getChatHistory,
  getTodayChatCount,
  getDailyLimit,
  generateOpeningLine,
  handleChatMessage,
} from "@/lib/portal/chat";

export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [history, todayCount, dailyLimit] = await Promise.all([
    getChatHistory(session.contactId),
    getTodayChatCount(session.contactId),
    getDailyLimit(session.contactId),
  ]);

  return NextResponse.json({
    messages: history,
    todayCount,
    dailyLimit,
    remainingToday: Math.max(0, dailyLimit - todayCount),
  });
}

export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    message?: string;
    action?: string;
    kickoffVariant?: boolean;
  };

  if (body.action === "opening_line") {
    const line = await generateOpeningLine(session.contactId, {
      kickoffVariant: body.kickoffVariant === true,
    });
    return NextResponse.json({ openingLine: line });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  if (body.message.length > 2000) {
    return NextResponse.json(
      { error: "Message too long (max 2000 characters)" },
      { status: 400 },
    );
  }

  const [todayCount, dailyLimit] = await Promise.all([
    getTodayChatCount(session.contactId),
    getDailyLimit(session.contactId),
  ]);

  if (todayCount >= dailyLimit) {
    return NextResponse.json(
      {
        error: "Daily chat limit reached. Try again tomorrow, or reach Andy directly at andy@superbadmedia.com.au.",
        remainingToday: 0,
      },
      { status: 429 },
    );
  }

  const result = await handleChatMessage(session.contactId, body.message);
  const newCount = todayCount + 1;

  return NextResponse.json({
    reply: result.reply,
    escalated: result.escalated,
    remainingToday: Math.max(0, dailyLimit - newCount),
  });
}
