"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { briefs } from "@/lib/db/schema/briefs";
import { brief_storyboards } from "@/lib/db/schema/brief-storyboards";
import { reviseStoryboard } from "@/lib/briefs/revise-storyboard";
import { generateStoryboard } from "@/lib/briefs/generate-storyboard";
import { logActivity } from "@/lib/activity-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user;
}

export async function reviseStoryboardAction(
  briefId: string,
  message: string,
): Promise<{ ok: true; changesSummary: string } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };
  return reviseStoryboard(briefId, message);
}

export async function generateStoryboardAction(
  briefId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };

  const brief = await db
    .select({ id: briefs.id })
    .from(briefs)
    .where(eq(briefs.id, briefId))
    .get();
  if (!brief) return { ok: false, error: "Brief not found." };

  const existing = await db
    .select({ id: brief_storyboards.id })
    .from(brief_storyboards)
    .where(eq(brief_storyboards.brief_id, briefId))
    .get();

  if (existing) {
    await db
      .delete(brief_storyboards)
      .where(eq(brief_storyboards.id, existing.id));
  }

  generateStoryboard(briefId).catch(() => {});
  revalidatePath(`/lite/admin/briefs/${briefId}`);
  return { ok: true };
}

export async function regenerateStoryboardAction(
  briefId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireAdmin();
  if (!user) return { ok: false, error: "Not authorised." };

  const existing = await db
    .select({ id: brief_storyboards.id, brief_id: brief_storyboards.brief_id })
    .from(brief_storyboards)
    .where(eq(brief_storyboards.brief_id, briefId))
    .get();

  if (existing) {
    await db
      .delete(brief_storyboards)
      .where(eq(brief_storyboards.id, existing.id));
  }

  const brief = await db
    .select({ id: briefs.id, company_id: briefs.company_id, reference_number: briefs.reference_number })
    .from(briefs)
    .where(eq(briefs.id, briefId))
    .get();

  if (!brief) return { ok: false, error: "Brief not found." };

  await logActivity({
    kind: "storyboard_regenerated",
    companyId: brief.company_id ?? undefined,
    body: `Storyboard regenerated for brief ${brief.reference_number}.`,
    meta: { brief_id: briefId },
  });

  generateStoryboard(briefId).catch(() => {});
  revalidatePath(`/lite/admin/briefs/${briefId}`);
  return { ok: true };
}
