export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduled-tasks/worker";
import { HANDLER_REGISTRY } from "@/lib/scheduled-tasks/handlers";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await tick(HANDLER_REGISTRY);

  return NextResponse.json({ ok: true, processed });
}
