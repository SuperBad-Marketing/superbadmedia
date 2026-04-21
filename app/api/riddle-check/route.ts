export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { resolveByAnswer } from "@/lib/riddles/resolve-by-answer";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ match: false });
  }

  const result = await resolveByAnswer(q, { actorType: "public" });

  if (result.outcome === "correct" || result.outcome === "common_wrong") {
    return NextResponse.json({
      match: true,
      outcome: result.outcome,
      answer: q,
    });
  }

  return NextResponse.json({ match: false });
}
