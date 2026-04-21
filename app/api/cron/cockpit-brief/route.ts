export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import type { CockpitBriefSlot } from "@/lib/db/schema/cockpit-briefs";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const slotParam = url.searchParams.get("slot") as CockpitBriefSlot | null;
  const slot = slotParam ?? getCurrentSlot();

  if (!["morning", "midday", "evening"].includes(slot)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const result = await generateBriefForSlot(slot, { trigger: "cron" });

  return NextResponse.json({ ok: true, ...result });
}
