import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/session";
import { getAnomalyDetail } from "@/lib/observatory/queries/anomaly-detail";
import { db } from "@/lib/db";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import settings from "@/lib/settings";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const detail = await getAnomalyDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body as { id?: string; action?: string };

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  if (action === "acknowledge") {
    const now = Date.now();
    const suppressHours = await settings.get("observatory.anomaly_suppress_hours");
    const suppressUntil = now + suppressHours * 60 * 60 * 1000;
    await db
      .update(cost_anomalies)
      .set({
        acknowledged_at_ms: now,
        acknowledged_until_ms: suppressUntil,
      })
      .where(eq(cost_anomalies.id, id));

    await logActivity({
      kind: "cost_anomaly_acknowledged",
      body: `Anomaly ${id} acknowledged and suppressed for ${suppressHours}h`,
      createdBy: session.user.id,
      meta: { anomaly_id: id, suppressed_until_ms: suppressUntil },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
