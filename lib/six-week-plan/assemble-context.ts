import "server-only";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import {
  deals,
  intro_funnel_submissions,
  trial_shoot_notes,
  brand_dna_profiles,
  leadCandidates,
} from "@/lib/db/schema";
import type {
  SixWeekContextBundle,
  ShootDayNotesContext,
} from "@/lib/ai/prompts/six-week-plan/strategy";

const TRIAL_SHOOT_OFFER =
  "60-minute on-site shoot + 1 short-form video + 10 edited photos + bespoke 6-week marketing plan + 60 days of client portal access. $297.";

export async function assembleSixWeekContext(
  dealId: string,
): Promise<SixWeekContextBundle> {
  const [deal, submission, notes, enrichmentRow] = await Promise.all([
    db.query.deals.findFirst({ where: eq(deals.id, dealId) }),
    db.query.intro_funnel_submissions.findFirst({
      where: eq(intro_funnel_submissions.deal_id, dealId),
    }),
    db.query.trial_shoot_notes.findFirst({
      where: eq(trial_shoot_notes.deal_id, dealId),
    }),
    db
      .select({ viability_profile_json: leadCandidates.viability_profile_json })
      .from(leadCandidates)
      .where(eq(leadCandidates.promoted_to_deal_id, dealId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const brandDna = deal
    ? await db.query.brand_dna_profiles.findFirst({
        where: and(
          eq(brand_dna_profiles.company_id, deal.company_id),
          eq(brand_dna_profiles.is_current, true),
          eq(brand_dna_profiles.status, "complete"),
        ),
      })
    : null;

  const questionnaireAnswers = submission?.questionnaire_answers_json
    ? (submission.questionnaire_answers_json as Record<string, unknown>)
    : null;

  const enrichmentProfile = enrichmentRow?.viability_profile_json
    ? (enrichmentRow.viability_profile_json as Record<string, unknown>)
    : null;

  let shootDayNotes: ShootDayNotesContext | null = null;
  if (notes?.filled_at_ms) {
    shootDayNotes = {
      infrastructure: {
        email_list: notes.infra_email_list,
        email_list_note: notes.infra_email_list_note,
        ad_experience: notes.infra_ad_experience,
        ad_experience_note: notes.infra_ad_experience_note,
        lead_magnet: notes.infra_lead_magnet,
        lead_magnet_note: notes.infra_lead_magnet_note,
        website_status: notes.infra_website_status,
        website_cms: notes.infra_website_cms,
        social_cadence: notes.infra_social_cadence,
        social_primary_platform: notes.infra_social_primary_platform,
        competitors: notes.infra_competitors,
      },
      goals: (notes.goals_json as Array<{ priority: number; text: string }>) ?? [],
      signals: {
        energy: notes.signal_energy ?? 3,
        fluency: notes.signal_fluency ?? 3,
        icp_clarity: notes.signal_icp_clarity ?? 3,
        conversion_ready: notes.signal_conversion_ready ?? 3,
      },
      observations: notes.observations ?? "",
    };
  }

  const brandDnaProfile = brandDna
    ? ({
        prose_portrait: brandDna.prose_portrait,
        signal_tags: brandDna.signal_tags
          ? JSON.parse(brandDna.signal_tags as string)
          : null,
        track: brandDna.track,
        shape: brandDna.shape,
      } as Record<string, unknown>)
    : null;

  return {
    questionnaireAnswers,
    enrichmentProfile,
    shootDayNotes,
    brandDnaProfile,
    trialShootOffer: TRIAL_SHOOT_OFFER,
  };
}
