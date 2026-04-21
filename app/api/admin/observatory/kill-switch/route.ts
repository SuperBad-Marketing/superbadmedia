import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/session";
import { toggleJobKillSwitch } from "@/lib/observatory/kill-switch-toggle";
import { isJobRegistered } from "@/lib/observatory";

const bodySchema = z.object({
  job: z.string().min(1),
  action: z.enum(["disable", "enable"]),
  anomaly_id: z.string().optional(),
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

  const { job, action, anomaly_id } = parsed.data;

  if (!isJobRegistered(job)) {
    return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 404 });
  }

  const result = await toggleJobKillSwitch({
    job,
    action,
    anomalyId: anomaly_id,
  });

  return NextResponse.json(result);
}
