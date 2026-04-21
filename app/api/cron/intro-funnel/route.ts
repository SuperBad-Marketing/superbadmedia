export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { runIntroFunnelHourlyCron } from "@/lib/intro-funnel/hourly-cron";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runIntroFunnelHourlyCron();

  return NextResponse.json({
    ok: true,
    transitioned: result.transitioned,
    errors: result.errors,
  });
}
