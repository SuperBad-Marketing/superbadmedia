"use server";

/**
 * Portal-side Brand DNA Assessment — Server Actions.
 *
 * Mirror of the admin actions at `/lite/brand-dna/actions.ts`, but
 * authenticated via portal session cookie (getPortalSession) instead of
 * NextAuth admin auth. Creates `client`-type profiles linked to the
 * contact record from the portal session.
 *
 * Owner: BDA-5.
 */

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { getPortalSession } from "@/lib/portal/guard";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { BRAND_DNA_TRACKS } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import {
  getQuestionsForSection,
  getQuestionById,
} from "@/lib/brand-dna/question-bank";

type BrandDnaTrack = (typeof BRAND_DNA_TRACKS)[number];

function isAssessmentEnabled(): boolean {
  return (
    killSwitches.brand_dna_assessment_enabled ||
    process.env.BRAND_DNA_GATE_BYPASS === "true"
  );
}

async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) {
    redirect("/lite/portal/recover");
  }
  return session;
}

/**
 * Find or create a client-type profile for the portal contact.
 */
async function getOrCreateClientProfile(
  contactId: string,
  companyId: string | null,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, contactId),
        eq(brand_dna_profiles.subject_type, "client"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { id: existing[0].id, isNew: false };
  }

  const newId = randomUUID();
  const now = Date.now();
  await db.insert(brand_dna_profiles).values({
    id: newId,
    subject_type: "client",
    subject_id: contactId,
    contact_id: contactId,
    company_id: companyId,
    is_current: true,
    is_superbad_self: false,
    status: "pending",
    created_at_ms: now,
    updated_at_ms: now,
  });

  return { id: newId, isNew: true };
}

async function updateSignalTags(
  profileId: string,
  newTagsAwarded: string[],
): Promise<void> {
  const profiles = await db
    .select({ signal_tags: brand_dna_profiles.signal_tags })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const existing = profiles[0];
  const tagMap: Record<string, number> = existing?.signal_tags
    ? (JSON.parse(existing.signal_tags) as Record<string, number>)
    : {};

  for (const tag of newTagsAwarded) {
    tagMap[tag] = (tagMap[tag] ?? 0) + 1;
  }

  await db
    .update(brand_dna_profiles)
    .set({ signal_tags: JSON.stringify(tagMap), updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));
}

// ── submitPortalAlignmentGate ───────────────────────────────────────────────

export async function submitPortalAlignmentGate(
  formData: FormData,
): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/portal");
  }

  const session = await requirePortalSession();

  const track = formData.get("track");
  if (
    !track ||
    typeof track !== "string" ||
    !(BRAND_DNA_TRACKS as readonly string[]).includes(track)
  ) {
    redirect("/lite/portal/brand-dna?error=invalid_track");
  }

  const { id: profileId, isNew } = await getOrCreateClientProfile(
    session.contactId,
    session.clientId,
  );

  await db
    .update(brand_dna_profiles)
    .set({
      track: track as BrandDnaTrack,
      status: "in_progress",
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  if (isNew) {
    await logActivity({
      kind: "assessment_started",
      body: `Brand DNA assessment started (track: ${track})`,
      contactId: session.contactId,
      companyId: session.clientId ?? undefined,
    });
  }

  redirect(`/lite/portal/brand-dna/section/1?profileId=${profileId}`);
}

// ── submitPortalAnswer ──────────────────────────────────────────────────────

export async function submitPortalAnswer(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/portal");
  }

  await requirePortalSession();

  const profileId = formData.get("profileId");
  const questionId = formData.get("questionId");
  const sectionRaw = formData.get("section");
  const selectedOption = formData.get("selectedOption");
  const tagsAwardedRaw = formData.get("tagsAwarded");

  if (
    !profileId ||
    typeof profileId !== "string" ||
    !questionId ||
    typeof questionId !== "string" ||
    !sectionRaw ||
    typeof sectionRaw !== "string" ||
    !selectedOption ||
    typeof selectedOption !== "string" ||
    !tagsAwardedRaw ||
    typeof tagsAwardedRaw !== "string"
  ) {
    redirect("/lite/portal/brand-dna");
  }

  const section = parseInt(sectionRaw, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    redirect("/lite/portal/brand-dna");
  }

  const question = getQuestionById(questionId);
  if (!question) {
    redirect(`/lite/portal/brand-dna/section/${section}`);
  }

  const validOptions = ["a", "b", "c", "d"] as const;
  type AnswerOpt = (typeof validOptions)[number];
  if (!(validOptions as readonly string[]).includes(selectedOption)) {
    redirect(`/lite/portal/brand-dna/section/${section}`);
  }

  let tagsAwarded: string[];
  try {
    tagsAwarded = JSON.parse(tagsAwardedRaw) as string[];
  } catch {
    tagsAwarded = [];
  }

  const existing = await db
    .select({ id: brand_dna_answers.id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.question_id, questionId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    await db.insert(brand_dna_answers).values({
      id: randomUUID(),
      profile_id: profileId,
      question_id: questionId,
      section,
      selected_option: selectedOption as AnswerOpt,
      tags_awarded: JSON.stringify(tagsAwarded),
      answered_at_ms: Date.now(),
    });

    await updateSignalTags(profileId, tagsAwarded);
  }

  await db
    .update(brand_dna_profiles)
    .set({
      current_section: section,
      status: "in_progress",
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  const allSectionAnswers = await db
    .select({ id: brand_dna_answers.id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const sectionQuestions = getQuestionsForSection(
    section as 1 | 2 | 3 | 4 | 5,
  );
  const sectionComplete = allSectionAnswers.length >= sectionQuestions.length;

  if (sectionComplete) {
    if (section === 5) {
      redirect(
        `/lite/portal/brand-dna/section/5/reflection?profileId=${profileId}`,
      );
    } else {
      redirect(
        `/lite/portal/brand-dna/section/${section}/insight?profileId=${profileId}`,
      );
    }
  } else {
    redirect(
      `/lite/portal/brand-dna/section/${section}?profileId=${profileId}`,
    );
  }
}

// ── submitPortalReflection ──────────────────────────────────────────────────

export async function submitPortalReflection(
  formData: FormData,
): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/portal");
  }

  await requirePortalSession();

  const profileId = formData.get("profileId");
  const reflection = formData.get("reflection");

  if (!profileId || typeof profileId !== "string") {
    redirect("/lite/portal/brand-dna");
  }

  const reflectionText =
    typeof reflection === "string" && reflection.trim().length > 0
      ? reflection.trim()
      : null;

  if (reflectionText) {
    await db
      .update(brand_dna_profiles)
      .set({ reflection_text: reflectionText, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, profileId));
  }

  redirect(`/lite/portal/brand-dna/reveal?profileId=${profileId}`);
}

// ── markPortalProfileComplete ───────────────────────────────────────────────

export async function markPortalProfileComplete(
  profileId: string,
): Promise<void> {
  if (!isAssessmentEnabled()) return;
  if (!profileId || typeof profileId !== "string") return;

  const session = await getPortalSession();
  if (!session) return;

  const rows = await db
    .select({
      id: brand_dna_profiles.id,
      status: brand_dna_profiles.status,
      contact_id: brand_dna_profiles.contact_id,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const existing = rows[0];
  if (!existing) return;
  if (existing.status === "complete") return;
  if (existing.contact_id !== session.contactId) return;

  await db
    .update(brand_dna_profiles)
    .set({
      status: "complete",
      completed_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  await logActivity({
    kind: "assessment_completed",
    body: "Brand DNA assessment completed",
    contactId: session.contactId,
    companyId: session.clientId ?? undefined,
  });
}

// ── getPortalProfileId ──────────────────────────────────────────────────────

export async function getPortalProfileId(): Promise<string | null> {
  const session = await getPortalSession();
  if (!session) return null;

  const rows = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, session.contactId),
        eq(brand_dna_profiles.subject_type, "client"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}
