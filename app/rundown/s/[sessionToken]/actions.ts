"use server";

import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { companies } from "@/lib/db/schema/companies";
import { BRAND_DNA_TRACKS } from "@/lib/db/schema/brand-dna-profiles";
import { logActivity } from "@/lib/activity-log";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";
import {
  getQuestionsForSection,
  getQuestionById,
} from "@/lib/brand-dna/question-bank";

type BrandDnaTrack = (typeof BRAND_DNA_TRACKS)[number];

async function resolveSession(
  sessionToken: string,
): Promise<{ sessionId: string; profileId: string; candidateId: string } | null> {
  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });
  if (!session?.profile_id || !session.candidate_id) return null;
  return {
    sessionId: session.id,
    profileId: session.profile_id,
    candidateId: session.candidate_id,
  };
}

function basePath(sessionToken: string): string {
  return `/rundown/s/${sessionToken}`;
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

export async function submitRundownAlignmentGate(
  sessionToken: string,
  formData: FormData,
): Promise<void> {
  const resolved = await resolveSession(sessionToken);
  if (!resolved) redirect("/rundown");

  const track = formData.get("track");
  if (
    !track ||
    typeof track !== "string" ||
    !(BRAND_DNA_TRACKS as readonly string[]).includes(track)
  ) {
    redirect(`${basePath(sessionToken)}?error=invalid_track`);
  }

  await db
    .update(brand_dna_profiles)
    .set({
      track: track as BrandDnaTrack,
      status: "in_progress",
      updated_at_ms: Date.now(),
    })
    .where(eq(brand_dna_profiles.id, resolved.profileId));

  await db
    .update(rundownSessions)
    .set({
      status: "assessment_started",
      assessment_started_at_ms: Date.now(),
      updated_at_ms: Date.now(),
    })
    .where(eq(rundownSessions.id, resolved.sessionId));

  await logActivity({
    kind: "rundown_assessment_started",
    body: `Rundown assessment started (track: ${track})`,
    meta: { candidateId: resolved.candidateId },
  });

  redirect(`${basePath(sessionToken)}/context`);
}

export async function submitRundownBusinessContext(
  sessionToken: string,
  formData: FormData,
): Promise<void> {
  const resolved = await resolveSession(sessionToken);
  if (!resolved) redirect("/rundown");

  const businessDoes = formData.get("businessDoes");
  const customers = formData.get("customers");
  const differentiator = formData.get("differentiator");

  if (
    !businessDoes || typeof businessDoes !== "string" ||
    !customers || typeof customers !== "string" ||
    !differentiator || typeof differentiator !== "string"
  ) {
    redirect(`${basePath(sessionToken)}/context?error=missing_fields`);
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
    .where(eq(brand_dna_profiles.id, resolved.profileId));

  redirect(`${basePath(sessionToken)}/intro`);
}

export async function submitRundownAnswer(
  sessionToken: string,
  formData: FormData,
): Promise<void> {
  const resolved = await resolveSession(sessionToken);
  if (!resolved) redirect("/rundown");

  const questionId = formData.get("questionId");
  const sectionRaw = formData.get("section");
  const selectedOption = formData.get("selectedOption");
  const tagsAwardedRaw = formData.get("tagsAwarded");

  if (
    !questionId || typeof questionId !== "string" ||
    !sectionRaw || typeof sectionRaw !== "string" ||
    !selectedOption || typeof selectedOption !== "string" ||
    !tagsAwardedRaw || typeof tagsAwardedRaw !== "string"
  ) {
    redirect(basePath(sessionToken));
  }

  const section = parseInt(sectionRaw, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    redirect(basePath(sessionToken));
  }

  const question = getQuestionById(questionId);
  if (!question) redirect(`${basePath(sessionToken)}/section/${section}`);

  const validOptions = ["a", "b", "c", "d"] as const;
  type AnswerOpt = (typeof validOptions)[number];
  if (!(validOptions as readonly string[]).includes(selectedOption)) {
    redirect(`${basePath(sessionToken)}/section/${section}`);
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
        eq(brand_dna_answers.profile_id, resolved.profileId),
        eq(brand_dna_answers.question_id, questionId),
      ),
    )
    .limit(1);

  if (!existing[0]) {
    await db.insert(brand_dna_answers).values({
      id: randomUUID(),
      profile_id: resolved.profileId,
      question_id: questionId,
      section,
      selected_option: selectedOption as AnswerOpt,
      tags_awarded: JSON.stringify(tagsAwarded),
      answered_at_ms: Date.now(),
    });

    await updateSignalTags(resolved.profileId, tagsAwarded);
  }

  await db
    .update(brand_dna_profiles)
    .set({ current_section: section, status: "in_progress", updated_at_ms: Date.now() })
    .where(eq(brand_dna_profiles.id, resolved.profileId));

  const allSectionAnswers = await db
    .select({ id: brand_dna_answers.id })
    .from(brand_dna_answers)
    .where(
      and(
        eq(brand_dna_answers.profile_id, resolved.profileId),
        eq(brand_dna_answers.section, section),
      ),
    );

  const sectionQuestions = getQuestionsForSection(section as 1 | 2 | 3 | 4 | 5);
  const sectionComplete = allSectionAnswers.length >= sectionQuestions.length;

  // Update session analytics
  if (sectionComplete) {
    const sectionKey = `section_${section}_completed_at_ms` as keyof typeof rundownSessions.$inferInsert;
    await db
      .update(rundownSessions)
      .set({
        [sectionKey]: Date.now(),
        status: `section_${section}_complete` as "section_1_complete",
        updated_at_ms: Date.now(),
      })
      .where(eq(rundownSessions.id, resolved.sessionId));
  }

  if (sectionComplete) {
    if (section === 5) {
      redirect(`${basePath(sessionToken)}/section/5/reflection`);
    } else {
      redirect(`${basePath(sessionToken)}/section/${section}/insight`);
    }
  } else {
    redirect(`${basePath(sessionToken)}/section/${section}`);
  }
}

export async function submitRundownReflection(
  sessionToken: string,
  formData: FormData,
): Promise<void> {
  const resolved = await resolveSession(sessionToken);
  if (!resolved) redirect("/rundown");

  const reflection = formData.get("reflection");
  const reflectionText =
    typeof reflection === "string" && reflection.trim().length > 0
      ? reflection.trim()
      : null;

  if (reflectionText) {
    await db
      .update(brand_dna_profiles)
      .set({ reflection_text: reflectionText, updated_at_ms: Date.now() })
      .where(eq(brand_dna_profiles.id, resolved.profileId));
  }

  redirect(`${basePath(sessionToken)}/reveal`);
}

export async function markRundownProfileComplete(
  sessionToken: string,
  profileId: string,
): Promise<void> {
  if (!profileId) return;

  const rows = await db
    .select({
      id: brand_dna_profiles.id,
      status: brand_dna_profiles.status,
      candidate_id: brand_dna_profiles.candidate_id,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, profileId))
    .limit(1);

  const existing = rows[0];
  if (!existing) return;
  if (existing.status === "complete") return;

  const now = Date.now();

  await db
    .update(brand_dna_profiles)
    .set({ status: "complete", completed_at_ms: now, updated_at_ms: now })
    .where(eq(brand_dna_profiles.id, profileId));

  const revealAccessToken = randomUUID().replace(/-/g, "").slice(0, 24);
  const revealExpiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  await db
    .update(rundownSessions)
    .set({
      status: "complete",
      reveal_reached_at_ms: now,
      completed_at_ms: now,
      reveal_access_token: revealAccessToken,
      reveal_access_expires_at_ms: revealExpiresAt,
      updated_at_ms: now,
    })
    .where(eq(rundownSessions.session_token, sessionToken));

  await logActivity({
    kind: "rundown_completed",
    body: "Rundown Brand DNA assessment completed",
    meta: { candidateId: existing.candidate_id ?? null },
  });

  // ── Auto-promote to pipeline deal ──
  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.session_token, sessionToken),
  });

  if (existing.candidate_id && session) {
    try {
      const result = createDealFromLead({
        company: {
          name: session.business_name,
          domain: session.website ?? undefined,
        },
        contact: {
          name: session.name,
          email: session.email,
        },
        source: "brand_dna_rundown",
        title: `Rundown, ${session.business_name}`,
        stage: "lead",
      });

      await db
        .update(leadCandidates)
        .set({
          promoted_to_deal_id: result.deal.id,
          promoted_at: new Date(now),
        })
        .where(eq(leadCandidates.id, existing.candidate_id));

      if (session.instagram_handle) {
        await db
          .update(companies)
          .set({ instagram_handle: session.instagram_handle })
          .where(eq(companies.id, result.company.id));
      }

      await logActivity({
        kind: "stage_change",
        body: `Auto-promoted Rundown candidate to pipeline: ${session.business_name}`,
        meta: {
          dealId: result.deal.id,
          candidateId: existing.candidate_id,
          trigger: "rundown_completion",
        },
      });
    } catch {
      // Deal creation failure is non-blocking, candidate stays in lead_candidates
    }
  }
  if (session?.email) {
    sendFollowupEmail(
      session.email,
      session.name,
      session.business_name,
      revealAccessToken,
      sessionToken,
    ).catch(() => {});
  }
}

async function sendFollowupEmail(
  email: string,
  name: string,
  businessName: string,
  revealAccessToken: string,
  sessionToken: string,
): Promise<void> {
  try {
    const { sendEmail } = await import("@/lib/channels/email/send");
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://superbadmedia.com.au";
    const revealUrl = `${baseUrl}/rundown/reveal/${revealAccessToken}`;
    const packUrl = `${baseUrl}/api/rundown/${sessionToken}/brand-pack`;
    const firstName = name.split(" ")[0];

    await sendEmail({
      to: email,
      subject: `your brand pack is ready, ${firstName}`,
      body: `
        <p>Hey ${firstName},</p>
        <p>Your Brand DNA for ${businessName} is complete. Here's what you've got:</p>
        <p><strong><a href="${revealUrl}" style="color: #B22848;">See your brand identity</a></strong><br>
        <span style="font-size: 14px; color: #807F73;">The full reveal, your signal tags, section insights, and prose portrait. Link expires in 30 days.</span></p>
        <p><strong><a href="${packUrl}" style="color: #B22848;">Download your Brand Pack</a></strong><br>
        <span style="font-size: 14px; color: #807F73;">Typography, colours, content pillars, and voice guide, all based on what you told us.</span></p>
        <p style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #252320; font-size: 14px; color: #807F73;">
          If any of what you saw in there made you want to do something about it, we do trial shoots. Real work, not a pitch meeting.
          <a href="${baseUrl}/trial-shoot" style="color: #B22848;">Have a look</a> if you're curious.
        </p>
        <p>Andy</p>
      `,
      classification: "rundown_followup",
      purpose: "rundown_completion_followup",
    });

    await db
      .update(rundownSessions)
      .set({ followup_email_sent_at_ms: Date.now(), updated_at_ms: Date.now() })
      .where(eq(rundownSessions.session_token, sessionToken));

    await logActivity({
      kind: "rundown_followup_sent",
      body: `Rundown follow-up email sent to ${email}`,
    });
  } catch {
    // Follow-up failure is non-blocking
  }
}

export async function trackRundownCtaClick(
  sessionToken: string,
  tier: string,
): Promise<void> {
  const now = Date.now();
  await db
    .update(rundownSessions)
    .set({
      tier_preference: tier,
      cta_clicked_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(rundownSessions.session_token, sessionToken));
}

export async function rundownGoBack(
  sessionToken: string,
  formData: FormData,
): Promise<void> {
  const resolved = await resolveSession(sessionToken);
  if (!resolved) redirect("/rundown");

  const sectionRaw = formData.get("section");
  const questionIndexRaw = formData.get("questionIndex");

  if (!sectionRaw || typeof sectionRaw !== "string") {
    redirect(basePath(sessionToken));
  }

  const section = parseInt(sectionRaw, 10);
  if (isNaN(section) || section < 1 || section > 5) {
    redirect(basePath(sessionToken));
  }

  const questionIndex = questionIndexRaw ? parseInt(String(questionIndexRaw), 10) : -1;
  const questions = getQuestionsForSection(section as 1 | 2 | 3 | 4 | 5);

  if (questionIndex === 0 && section > 1) {
    const prevSection = (section - 1) as 1 | 2 | 3 | 4 | 5;
    const prevQuestions = getQuestionsForSection(prevSection);
    const lastQuestion = prevQuestions[prevQuestions.length - 1];
    if (lastQuestion) {
      await deleteAnswerAndTags(resolved.profileId, lastQuestion.id);
    }
    redirect(`${basePath(sessionToken)}/section/${prevSection}`);
  }

  if (questionIndex > 0) {
    const prevQuestion = questions[questionIndex - 1];
    if (prevQuestion) {
      await deleteAnswerAndTags(resolved.profileId, prevQuestion.id);
    }
  }

  redirect(`${basePath(sessionToken)}/section/${section}`);
}

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

  await db.delete(brand_dna_answers).where(eq(brand_dna_answers.id, answer.id));
}
