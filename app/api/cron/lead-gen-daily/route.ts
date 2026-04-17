/**
 * Lead Generation daily cron handler.
 *
 * Triggered by Coolify's cron scheduler at 03:00 Melbourne time daily.
 * Protected by CRON_SECRET to prevent unauthorised invocation.
 *
 * POST /api/cron/lead-gen-daily
 */

import { NextRequest, NextResponse } from "next/server";
import { runLeadGenDaily } from "@/lib/lead-gen/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runLeadGenDaily("scheduled");
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error("[cron/lead-gen-daily] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
