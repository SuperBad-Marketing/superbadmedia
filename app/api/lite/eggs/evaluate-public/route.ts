/**
 * POST /api/lite/eggs/evaluate-public
 *
 * Called by the public egg orchestrator on marketing pages.
 * No auth required — public visitors only. Client sends context
 * (dwell, scroll, referrer, etc.), server resolves Melbourne
 * weather/holidays and evaluates triggers.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orchestratePublicEggs } from "@/lib/eggs/orchestrate-public";

const InputSchema = z.object({
  localHour: z.number().int().min(0).max(23),
  dayOfWeek: z.number().int().min(0).max(6),
  referrer: z.string().max(2000),
  dwellMs: z.number().min(0),
  scrollDepth: z.number().min(0).max(1),
  scrollDurationMs: z.number().min(0),
  tabBackgroundedMs: z.number().min(0),
  timezone: z.string().max(100),
  visitCount: z.number().int().min(0),
  sessionId: z.string().max(100),
  isMobile: z.boolean(),
  firstEggDeliveredAt: z.number().nullable(),
  lastHiddenEggFiredAt: z.number().nullable(),
  firedEggIds: z.array(z.string().max(80)).max(100),
  tricksDisabled: z.boolean(),
  sessionFiredEggIds: z.array(z.string().max(80)).max(20),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const result = await orchestratePublicEggs(parsed.data);

  return NextResponse.json(result);
}
