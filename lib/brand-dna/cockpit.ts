import { and, eq, lte } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;
const STUCK_THRESHOLD_DAYS = 7;

export async function getBrandDnaWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const staleThreshold = nowMs - STUCK_THRESHOLD_DAYS * MS_PER_DAY;

  const stuckAssessments = await db
    .select({
      id: brand_dna_profiles.id,
      subject_display_name: brand_dna_profiles.subject_display_name,
      updated_at_ms: brand_dna_profiles.updated_at_ms,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.status, "in_progress"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.subject_type, "client"),
        lte(brand_dna_profiles.updated_at_ms, staleThreshold),
      ),
    )
    .all();

  for (const a of stuckAssessments) {
    const name = a.subject_display_name ?? "Assessment";
    items.push({
      id: `brand_dna_stuck_${a.id}`,
      label: `${name} — Brand DNA stalled`,
      href: `/lite/brand-dna/${a.id}`,
      urgency: { kind: "age_of_wait", value: a.updated_at_ms },
      scope: "own",
      source: "brand-dna-assessment",
    });
  }

  return items;
}
