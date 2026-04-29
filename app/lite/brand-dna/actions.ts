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

  redirect(`/lite/brand-dna/context`);
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

  redirect(`/lite/brand-dna/reveal?profileId=${profileId}`);
}

// ── markProfileComplete ──────────────────────────────────────────────────────

/**
 * Mark a profile as complete (or awaiting approval for superbad_self).
 *
 * Called by the reveal client at the end of the cinematic sequence, once the
 * first impression + prose portrait are both on screen.
 *
 * For superbad_self profiles: sets `status = 'awaiting_approval'`. The profile
 * won't cascade into LLM calls until explicitly approved from the Profile page.
 * For client profiles: sets `status = 'complete'` immediately.
 *
 * Idempotent: safe to call more than once. No-ops if already complete or
 * awaiting approval.
 */
export async function markProfileComplete(profileId: string): Promise<void> {
  if (!isAssessmentEnabled()) return;
  if (!profileId || typeof profileId !== "string") return;

  const rows = await db
    .select({
      id: brand_dna_profiles.id,
      status: brand_dna_profiles.status,
      subject_type: brand_dna_profiles.subject_type,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const existing = rows[0];
  if (!existing) return;
  if (existing.status === "complete" || existing.status === "awaiting_approval") return;

  const isSuperbadSelf = existing.subject_type === "superbad_self";
  const targetStatus = isSuperbadSelf ? "awaiting_approval" : "complete";

  await db
    .update(brand_dna_profiles)
    .set({
      status: targetStatus,
      completed_at_ms: isSuperbadSelf ? null : Date.now(),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  const session = await auth();
  await logActivity({
    kind: isSuperbadSelf
      ? "brand_dna_awaiting_approval"
      : "onboarding_brand_dna_completed",
    body: isSuperbadSelf
      ? "Brand DNA assessment ready for review"
      : "Brand DNA assessment complete",
    createdBy: session?.user?.id ?? null,
  });
}

// ── retakeAssessment ────────────────────────────────────────────────────────

/**
 * Archive the current completed profile and redirect to /lite/brand-dna
 * so the user starts a fresh assessment from scratch.
 */
export async function retakeAssessment(): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/brand-dna");
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const rows = await db
    .select({ id: brand_dna_profiles.id, status: brand_dna_profiles.status })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .limit(1);

  const profile = rows[0];
  if (profile) {
    await db
      .update(brand_dna_profiles)
      .set({ is_current: false, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, profile.id));
  }

  await logActivity({
    kind: "assessment_restarted",
    body: "Brand DNA retake — previous profile archived, starting fresh",
    createdBy: session.user.id,
  });

  redirect("/lite/brand-dna");
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function deleteAnswerAndTags(profileId: string, questionId: string): Promise<void> {
  const [answer] = await db
    .select({ id: brand_dna_answers.id, tags_awarded: brand_dna_answers.tags_awarded })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, profileId),
        eq(brand_dna_answers.question_id, questionId),
      ),
    )
    .limit(1);

  if (!answer) return;

  let removedTags: string[] = [];
  try {
    removedTags = JSON.parse(answer.tags_awarded ?? "[]") as string[];
  } catch {}

  if (removedTags.length > 0) {
    const profiles = await db
      .select({ signal_tags: brand_dna_profiles.signal_tags })
      .from(brand_dna_profiles)
      .where(eq(brand_dna_profiles.id, profileId))
      .limit(1);

    if (profiles[0]?.signal_tags) {
      const tagMap = JSON.parse(profiles[0].signal_tags) as Record<string, number>;
      for (const tag of removedTags) {
        if (tagMap[tag]) {
          tagMap[tag]--;
          if (tagMap[tag] <= 0) delete tagMap[tag];
        }
      }
      await db
        .update(brand_dna_profiles)
        .set({ signal_tags: JSON.stringify(tagMap), updated_at_ms: Date.now() })
        .where(eq(brand_dna_profiles.id, profileId));
    }
  }

  await db
    .delete(brand_dna_answers)
    .where(eq(brand_dna_answers.id, answer.id));
}

// ── goBack ──────────────────────────────────────────────────────────────────

/**
 * Delete the most recent answer in the given section and redirect back to
 * the section page so the question reappears. Used by the "Back" button.
 */
export async function goBack(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/onboarding");
  }

  const profileId = formData.get("profileId");
  const sectionRaw = formData.get("section");
  const questionIndexRaw = formData.get("questionIndex");

  if (
    !profileId ||
    typeof profileId !== "string" ||
    !sectionRaw ||
    typeof sectionRaw !== "string"
  ) {
    redirect("/lite/brand-dna");
  }

  const section = parseInt(sectionRaw, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    redirect("/lite/brand-dna");
  }

  const questionIndex = questionIndexRaw ? parseInt(String(questionIndexRaw), 10) : -1;

  // Get the question bank for this section to find the previous question
  const questions = getQuestionsForSection(section as 1 | 2 | 3 | 4 | 5);

  if (questionIndex === 0 && section > 1) {
    // Cross-section: go back to last question of previous section
    const prevSection = (section - 1) as 1 | 2 | 3 | 4 | 5;
    const prevQuestions = getQuestionsForSection(prevSection);
    const lastQuestion = prevQuestions[prevQuestions.length - 1];
    if (lastQuestion) {
      await deleteAnswerAndTags(profileId, lastQuestion.id);
    }
    redirect(`/lite/brand-dna/section/${prevSection}?profileId=${profileId}`);
  }

  if (questionIndex > 0) {
    const prevQuestion = questions[questionIndex - 1];
    if (prevQuestion) {
      await deleteAnswerAndTags(profileId, prevQuestion.id);
    }
  }

  redirect(`/lite/brand-dna/section/${section}?profileId=${profileId}`);
}

// ── restartAssessment ─────────────────────────────────────────────────────

export async function restartAssessment(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/brand-dna");
  }

  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const profileId = formData.get("profileId");
  if (!profileId || typeof profileId !== "string") {
    redirect("/lite/brand-dna");
  }

  const rows = await db
    .select({
      id: brand_dna_profiles.id,
      status: brand_dna_profiles.status,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const profile = rows[0];
  if (!profile) {
    redirect("/lite/brand-dna");
  }
  if (profile.status === "complete") {
    redirect("/lite/brand-dna/reveal");
  }

  await db
    .delete(brand_dna_answers)
    .where(eq(brand_dna_answers.profile_id, profileId));

  await db
    .update(brand_dna_profiles)
    .set({
      current_section: 1,
      signal_tags: null,
      section_insights: null,
      first_impression: null,
      prose_portrait: null,
      reflection_text: null,
      status: "pending",
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  await logActivity({
    kind: "assessment_restarted",
    body: "Brand DNA assessment restarted from the beginning",
  });

  redirect(`/lite/brand-dna?profileId=${profileId}`);
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

// ── submitBusinessContext ──────────────────────────────────────────────────

export async function submitBusinessContext(formData: FormData): Promise<void> {
  if (!isAssessmentEnabled()) {
    redirect("/lite/onboarding");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/lite/login");
  }

  const profileId = formData.get("profileId");
  const businessDoes = formData.get("businessDoes");
  const customers = formData.get("customers");
  const differentiator = formData.get("differentiator");

  if (
    !profileId || typeof profileId !== "string" ||
    !businessDoes || typeof businessDoes !== "string" ||
    !customers || typeof customers !== "string" ||
    !differentiator || typeof differentiator !== "string"
  ) {
    redirect("/lite/brand-dna/context?error=missing_fields");
  }

  const context = {
    businessDoes: businessDoes.trim(),
    customers: customers.trim(),
    differentiator: differentiator.trim(),
  };

  await db
    .update(brand_dna_profiles)
    .set({
      business_context: JSON.stringify(context),
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, profileId));

  redirect(`/lite/brand-dna/intro`);
}
