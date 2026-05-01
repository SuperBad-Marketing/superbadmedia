import { eq } from "drizzle-orm";
import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import { rundownSessions } from "@/lib/db/schema/rundown-sessions";
import { rundown_sequence_emails } from "@/lib/db/schema/rundown-sequence-emails";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import { generateSequenceEmail } from "@/lib/rundown/sequence-generate";
import type { SequenceContext, EnrichmentSummary, PreviousEmailContext } from "@/lib/rundown/sequence-briefs";
import type { ViabilityProfile } from "@/lib/lead-gen/types";
import type { RundownSequenceTrack } from "@/lib/db/schema/rundown-sequence-emails";

interface SequencePayload {
  emailId: string;
  sessionId: string;
  sessionToken: string;
  candidateId: string;
  emailNumber: number;
  track: RundownSequenceTrack;
}

async function handleRundownSequenceSend(
  payload: SequencePayload,
): Promise<void> {
  const emailRow = await db.query.rundown_sequence_emails.findFirst({
    where: eq(rundown_sequence_emails.id, payload.emailId),
  });
  if (!emailRow || emailRow.status !== "pending") return;

  const session = await db.query.rundownSessions.findFirst({
    where: eq(rundownSessions.id, payload.sessionId),
  });
  if (!session) return;

  const candidate = await db
    .select({
      viability_profile_json: leadCandidates.viability_profile_json,
      saas_score: leadCandidates.saas_score,
      retainer_score: leadCandidates.retainer_score,
      qualified_track: leadCandidates.qualified_track,
    })
    .from(leadCandidates)
    .where(eq(leadCandidates.id, payload.candidateId))
    .get();

  const profile = session.profile_id
    ? await db
        .select({
          signal_tags: brand_dna_profiles.signal_tags,
          first_impression: brand_dna_profiles.first_impression,
          signal_descriptions_json: brand_dna_profiles.signal_descriptions_json,
          prose_portrait: brand_dna_profiles.prose_portrait,
          section_insights: brand_dna_profiles.section_insights,
        })
        .from(brand_dna_profiles)
        .where(eq(brand_dna_profiles.id, session.profile_id))
        .get()
    : null;

  const previousEmails = await db
    .select()
    .from(rundown_sequence_emails)
    .where(eq(rundown_sequence_emails.session_id, payload.sessionId));

  const previousContext: PreviousEmailContext[] = previousEmails
    .filter((e) => e.email_number < payload.emailNumber && e.status === "sent")
    .map((e) => ({
      emailNumber: e.email_number,
      opened: !!e.opened_at_ms,
      clicked: !!e.clicked_at_ms,
      clickedLinks: (e.clicked_links as string[]) ?? [],
    }));

  const viability = (candidate?.viability_profile_json ?? {}) as ViabilityProfile;
  const enrichmentSummary = buildEnrichmentSummary(viability);
  const signalTags = parseSignalTags(profile?.signal_tags ?? null);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://superbadmedia.com.au";
  const revealUrl = session.reveal_access_token
    ? `${baseUrl}/rundown/reveal/${session.reveal_access_token}`
    : `${baseUrl}/rundown/s/${session.session_token}/reveal`;

  let signalDescriptions: Record<string, string> = {};
  try {
    if (profile?.signal_descriptions_json) {
      signalDescriptions = JSON.parse(profile.signal_descriptions_json) as Record<string, string>;
    }
  } catch { /* skip */ }

  let sectionInsights: string[] = [];
  try {
    if (profile?.section_insights) {
      const parsed = JSON.parse(profile.section_insights);
      if (Array.isArray(parsed)) {
        sectionInsights = parsed.filter((s): s is string => typeof s === "string" && s.length > 0);
      }
    }
  } catch { /* skip */ }

  let gapReveal: SequenceContext["gapReveal"] = null;
  try {
    if (session.gap_reveal_json) {
      gapReveal = JSON.parse(session.gap_reveal_json) as SequenceContext["gapReveal"];
    }
  } catch { /* skip */ }

  const ctx: SequenceContext = {
    firstName: session.name.split(" ")[0],
    businessName: session.business_name,
    track: payload.track,
    signalTags,
    firstImpression: profile?.first_impression ?? null,
    enrichmentSummary,
    icpScores: {
      saas: candidate?.saas_score ?? 0,
      retainer: candidate?.retainer_score ?? 0,
      track: (candidate?.qualified_track as "saas" | "retainer" | null) ?? null,
    },
    revealUrl,
    trialShootUrl: `${baseUrl}/trial-shoot?ref=rundown_seq&email=${payload.emailNumber}`,
    productionUrl: `${baseUrl}/production`,
    previousEmailsContext: previousContext,
    gapReveal,
    signalDescriptions,
    prosePortrait: profile?.prose_portrait ?? null,
    sectionInsights,
  };

  const generated = await generateSequenceEmail(
    payload.emailNumber,
    ctx,
  );

  const result = await sendEmail({
    to: session.email,
    subject: generated.subject,
    body: generated.bodyHtml,
    classification: "rundown_sequence",
    purpose: `rundown_sequence_email_${payload.emailNumber}`,
    replyTo: "andy@superbadmedia.com.au",
  });

  const now = Date.now();

  if (result.sent) {
    await db
      .update(rundown_sequence_emails)
      .set({
        status: "sent",
        subject: generated.subject,
        body_html: generated.bodyHtml,
        sent_at_ms: now,
        resend_message_id: result.messageId ?? null,
      })
      .where(eq(rundown_sequence_emails.id, payload.emailId));

    await logActivity({
      kind: "rundown_sequence_sent",
      body: `Rundown sequence email ${payload.emailNumber} sent to ${session.email}`,
      meta: {
        emailId: payload.emailId,
        emailNumber: payload.emailNumber,
        track: payload.track,
        candidateId: payload.candidateId,
      },
    });
  } else if (result.skipped) {
    await db
      .update(rundown_sequence_emails)
      .set({ status: "cancelled", cancelled_at_ms: now, cancel_reason: result.reason ?? "skipped" })
      .where(eq(rundown_sequence_emails.id, payload.emailId));
  }
}

function buildEnrichmentSummary(v: ViabilityProfile): EnrichmentSummary {
  return {
    instagramFollowers: v.instagram?.follower_count ?? null,
    instagramPostsLast30d: v.instagram?.posts_last_30d ?? null,
    googleReviewCount: v.maps?.review_count ?? null,
    googleRating: v.maps?.rating ?? null,
    websitePerformanceScore: v.website?.pagespeed_performance_score ?? null,
    hasAboutPage: v.website?.has_about_page ?? null,
    facebookActive: v.facebook?.has_active_page ?? null,
    facebookPostsLast30d: v.facebook?.posts_last_30d ?? null,
    youtubeVideoCount: v.youtube?.video_count ?? null,
  };
}

function parseSignalTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string").slice(0, 8);
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, Record<string, number>>)
        .flatMap(([, domain]) => Object.entries(domain))
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 8)
        .map(([tag]) => tag.replace(/_/g, " "));
    }
  } catch { /* */ }
  return [];
}

export const RUNDOWN_SEQUENCE_HANDLERS: HandlerMap = {
  rundown_sequence_send: async (task) => {
    const payload = task.payload as unknown as SequencePayload;
    await handleRundownSequenceSend(payload);
  },
};
