import { and, eq, isNull, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { wizard_progress } from "@/lib/db/schema/wizard-progress";
import settings from "@/lib/settings";
import type { HealthBanner } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;

export async function getWizardHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const banners: HealthBanner[] = [];

  const idleDays = await settings.get("wizards.admin_cockpit_banner_days");
  const threshold = nowMs - idleDays * MS_PER_DAY;

  const idleWizards = await db
    .select({
      id: wizard_progress.id,
      wizard_key: wizard_progress.wizard_key,
      last_active_at_ms: wizard_progress.last_active_at_ms,
    })
    .from(wizard_progress)
    .where(
      and(
        eq(wizard_progress.audience, "admin"),
        isNull(wizard_progress.abandoned_at_ms),
        lte(wizard_progress.last_active_at_ms, threshold),
      ),
    )
    .all();

  for (const w of idleWizards) {
    const daysSinceActive = Math.floor(
      (nowMs - w.last_active_at_ms) / MS_PER_DAY,
    );
    const label = w.wizard_key.replace(/-/g, " ");

    banners.push({
      id: `wizard_idle:${w.id}`,
      severity: daysSinceActive >= idleDays * 2 ? "critical" : "warning",
      summary: `Setup wizard "${label}" idle for ${daysSinceActive} days. Resume or abandon it.`,
      href: `/lite/setup/admin/${w.wizard_key}`,
      source: "setup-wizards",
    });
  }

  return banners;
}
