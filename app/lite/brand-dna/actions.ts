"use server";

/**
 * Brand DNA Assessment — Server Actions.
 *
 * Three actions own the assessment write path:
 *   - submitAlignmentGate  → creates/resumes profile, sets track, redirects to section 1
 *   - submitAnswer         → saves answer, updates signal_tags, redirects to next destination
 *   - submitReflection     → saves reflection_text (section 5 optional), redirects to stub complete
 *
 * All actions gate on `brand_dna_assessment_enabled` kill-switch.
 * `BRAND_DNA_GATE_BYPASS=true` in the environment also enables the assessment
 * (consistent with the development bypass in proxy.ts).
 *
 * Profile resolution: admin (superbad_self) path — auth() provides user identity.
 * Client-via-invite path is a future BDA wave.
 *
 * Owner: BDA-2.
 */

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
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

/** Returns true when the assessment is enabled (kill-switch or bypass env). */
function isAssessmentEnabled(): boolean {
  return (
    killSwitches.brand_dna_assessment_enabled ||
    process.env.BRAND_DNA_GATE_BYPASS === "true"
  );
}

/**
 * Find or create the superbad_self profile for the currently authenticated user.
 * Returns null if the user is not authenticated.
 */
async function getOrCreateSelfProfile(): Promise<{ id: string; isNew: boolean }> {
  const existing = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
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
    subject_type: "superbad_self",
    is_superbad_self: true,
    is_current: true,
    status: "in_progress",
    created_at_ms: now,
    updated_at_ms: now,
  });

  return { id: newId, isNew: true };
}

/**
 * Aggregate signal tags across all answered questions in a section and
 * merge into the profile's signal_tags JSON.
 */
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

// ── submitAlignmentGate ──────────────────────────────────────────────────────

/**
 * Process the alignment gate question.
 *
 * Expected FormData fields:
 *   - track: "founder" | "business" | "founder_supplement"
 */
export async function submitAlignmentGate(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/onboarding");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/lite/login");
  }

  const track = formData.get("track");
  if (
    !track ||
    typeof track !== "string" ||
    !(BRAND_DNA_TRACKS as readonly string[]).includes(track)
  ) {
    redirect("/lite/brand-dna?error=invalid_track");
  }

  const { id: profileId, isNew } = await getOrCreateSelfProfile();

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
      kind: "onboarding_brand_dna_started",
      body: `Brand DNA assessment started (track: ${track})`,
      createdBy: session.user.id,
    });
  }

  redirect(`/lite/brand-dna/section/1`);
}

// ── submitAnswer ─────────────────────────────────────────────────────────────

/**
 * Save an answer and advance to the next destination.
 *
 * Expected FormData fields:
 *   - profileId: string
 *   - questionId: string
 *   - section: string (number 1–5)
 *   - selectedOption: "a" | "b" | "c" | "d"
 *   - tagsAwarded: JSON string (string[])
 */
export async function submitAnswer(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/onboarding");
  }

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
    redirect("/lite/brand-dna");
  }

  const section = parseInt(sectionRaw, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    redirect("/lite/brand-dna");
  }

  const question = getQuestionById(questionId);
  if (!question) {
    redirect(`/lite/brand-dna/section/${section}`);
  }

  const validOptions = ["a", "b", "c", "d"] as const;
  type AnswerOpt = (typeof validOptions)[number];
  if (!(validOptions as readonly string[]).includes(selectedOption)) {
    redirect(`/lite/brand-dna/section/${section}`);
  }

  let tagsAwarded: string[];
  try {
    tagsAwarded = JSON.parse(tagsAwardedRaw) as string[];
  } catch {
    tagsAwarded = [];
  }

  // Idempotency: skip insert if this question is already answered
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

  // Update current_section to track where the user is
  await db
    .update(brand_dna_profiles)
    .set({ current_section: section, status: "in_progress", updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, profileId));

  // Count answers in this section (after insert)
  const allSectionAnswers = await db
    .select({ id: brand_dna_answers.id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const sectionQuestions = getQuestionsForSection(section as 1 | 2 | 3 | 4 | 5);
  const sectionComplete = allSectionAnswers.length >= sectionQuestions.length;

  if (sectionComplete) {
    if (section === 5) {
      // Section 5 → reflection page (optional)
      redirect(`/lite/brand-dna/section/5/reflection?profileId=${profileId}`);
    } else {
      // Sections 1–4 → between-section insight
      redirect(`/lite/brand-dna/section/${section}/insight?profileId=${profileId}`);
    }
  } else {
    // More questions remain in this section
    redirect(`/lite/brand-dna/section/${section}?profileId=${profileId}`);
  }
}

// ── submitReflection ─────────────────────────────────────────────────────────

/**
 * Save optional reflection text (section 5 only).
 *
 * Expected FormData fields:
 *   - profileId: string
 *   - reflection: string (may be empty — user skipped)
 */
export async function submitReflection(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/onboarding");
  }

  const profileId = formData.get("profileId");
  const reflection = formData.get("reflection");

  if (!profileId || typeof profileId !== "string") {
    redirect("/lite/brand-dna");
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

  // BDA-3 builds the reveal. Redirect to a stub complete placeholder.
  redirect(`/lite/brand-dna/section/5/insight?profileId=${profileId}`);
}

// ── Exported helpers (for section page to read profile ID without auth) ───────

/**
 * Resolve the current superbad_self profile ID for an authenticated user.
 * Returns null if no authenticated session or no profile exists.
 */
export async function getSelfProfileId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = await db
    .select({ id: brand_dna_profiles.id })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  return rows[0]?.id ?? null;
}
