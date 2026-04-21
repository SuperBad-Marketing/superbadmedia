export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/session";
import { adjustBands } from "@/lib/observatory";
import { isJobRegistered } from "@/lib/observatory";

const bodySchema = z.object({
  job: z.string().min(1),
  per_call_ceiling_aud: z.number().nonnegative().nullable().optional(),
  daily_ceiling_aud: z.number().nonnegative().nullable().optional(),
  learned_band_multiplier: z.number().positive().nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { job, per_call_ceiling_aud, daily_ceiling_aud, learned_band_multiplier } = parsed.data;

  if (!isJobRegistered(job)) {
    return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 404 });
  }

  const result = await adjustBands({
    job,
    per_call_ceiling_aud: per_call_ceiling_aud ?? undefined,
    daily_ceiling_aud: daily_ceiling_aud ?? undefined,
    learned_band_multiplier: learned_band_multiplier ?? undefined,
  });

  return NextResponse.json(result);
}
