export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/session";
import settings from "@/lib/settings";
import { logActivity } from "@/lib/activity-log";
import {
  getObservatorySettings,
  getJobBandList,
} from "@/lib/observatory/queries/settings";

const PatchSchema = z.object({
  threshold_1_aud: z.number().min(0).nullable().optional(),
  threshold_2_aud: z.number().min(0).nullable().optional(),
  threshold_3_aud: z.number().min(0).nullable().optional(),
  projection_alert_enabled: z.boolean().optional(),
  weekly_digest_enabled: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settingsData, jobs] = await Promise.all([
    getObservatorySettings(),
    getJobBandList(),
  ]);

  return NextResponse.json({ settings: settingsData, jobs });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates = parsed.data;
  const changed: string[] = [];

  if (updates.threshold_1_aud !== undefined) {
    await settings.set(
      "observatory.monthly_threshold_1_aud",
      updates.threshold_1_aud == null ? "" : String(updates.threshold_1_aud),
    );
    changed.push("threshold_1_aud");
  }
  if (updates.threshold_2_aud !== undefined) {
    await settings.set(
      "observatory.monthly_threshold_2_aud",
      updates.threshold_2_aud == null ? "" : String(updates.threshold_2_aud),
    );
    changed.push("threshold_2_aud");
  }
  if (updates.threshold_3_aud !== undefined) {
    await settings.set(
      "observatory.monthly_threshold_3_aud",
      updates.threshold_3_aud == null ? "" : String(updates.threshold_3_aud),
    );
    changed.push("threshold_3_aud");
  }
  if (updates.projection_alert_enabled !== undefined) {
    await settings.set(
      "observatory.projection_alert_enabled",
      String(updates.projection_alert_enabled),
    );
    changed.push("projection_alert_enabled");
  }
  if (updates.weekly_digest_enabled !== undefined) {
    await settings.set(
      "observatory.weekly_digest_enabled",
      String(updates.weekly_digest_enabled),
    );
    changed.push("weekly_digest_enabled");
  }

  if (changed.length > 0) {
    await logActivity({
      kind: "observatory_settings_changed",
      createdBy: session.user.id,
      body: `Updated: ${changed.join(", ")}`,
    });
  }

  const updated = await getObservatorySettings();
  return NextResponse.json({ settings: updated });
}
