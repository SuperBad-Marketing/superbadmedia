/**
 * Intro Funnel abandon tracking — spec §14.
 *
 * Self-perpetuating daily check. Thresholds:
 *   pending   → 15 min  → SMS (hardcoded template)    → t_15m_sent
 *   t_15m_sent → 24h    → SMS + email (Haiku-drafted) → t_24h_sent
 *   t_24h_sent → 3d     → email (Haiku-drafted)       → t_3d_sent
 *   t_3d_sent  → 3d+1h  → demote Deal → Lost          → demoted
 *
 * Any portal activity resets last_activity_at and sequence state to pending.
 *
 * Owner: IF-3.
 */
import { eq, and, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  intro_funnel_submissions,
  type AbandonSequenceState,
} from "@/lib/db/schema/intro-funnel-submissions";
import { deals } from "@/lib/db/schema/deals";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { sendSms } from "@/lib/channels/sms/send";
import { sendEmail } from "@/lib/channels/email/send";
import { invokeLlmText } from "@/lib/ai/invoke";
import { checkBrandVoiceDrift } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

const MINS_15 = 15 * 60 * 1000;
const HOURS_1 = 60 * 60 * 1000;
const HOURS_24 = 24 * 60 * 60 * 1000;
const DAYS_3 = 3 * 24 * 60 * 60 * 1000;

interface AbandonCheckResult {
  processed: number;
  errors: string[];
}

export async function runAbandonCheck(): Promise<AbandonCheckResult> {
  const now = Date.now();
  let processed = 0;
  const errors: string[] = [];

  const eligible = await db
    .select()
    .from(intro_funnel_submissions)
    .where(
      and(
        inArray(intro_funnel_submissions.funnel_state, [
          "contact_submitted",
          "questionnaire_in_progress",
          "questionnaire_complete",
        ]),
        inArray(intro_funnel_submissions.abandon_sequence_state, [
          "pending",
          "t_15m_sent",
          "t_24h_sent",
          "t_3d_sent",
        ]),
      ),
    );

  for (const sub of eligible) {
    const elapsed = now - sub.last_activity_at_ms;
    const sinceCreation = now - sub.created_at_ms;

    try {
      if (sub.abandon_sequence_state === "pending" && elapsed >= MINS_15) {
        await send15mSms(sub);
        await updateAbandonState(sub.id, sub.deal_id, "t_15m_sent", "intro_funnel_abandon_15m_sent");
        processed++;
      } else if (sub.abandon_sequence_state === "t_15m_sent" && sinceCreation >= HOURS_24) {
        await send24hSmsAndEmail(sub);
        await updateAbandonState(sub.id, sub.deal_id, "t_24h_sent", "intro_funnel_abandon_24h_sent");
        processed++;
      } else if (sub.abandon_sequence_state === "t_24h_sent" && sinceCreation >= DAYS_3) {
        await send3dEmail(sub);
        await updateAbandonState(sub.id, sub.deal_id, "t_3d_sent", "intro_funnel_abandon_3d_sent");
        processed++;
      } else if (sub.abandon_sequence_state === "t_3d_sent" && sinceCreation >= DAYS_3 + HOURS_1) {
        await demoteToLost(sub);
        processed++;
      }
    } catch (e) {
      errors.push(`abandon check failed for ${sub.id}: ${e}`);
    }
  }

  return { processed, errors };
}

export async function ensureAbandonCheckEnqueued(): Promise<void> {
  const NEXT_CHECK_DELAY = 60 * 60 * 1000; // hourly
  await enqueueTask({
    task_type: "intro_funnel_abandon_check",
    runAt: Date.now() + NEXT_CHECK_DELAY,
    payload: {},
    idempotencyKey: "intro_funnel_abandon_check_hourly",
  });
}

async function send15mSms(
  sub: typeof intro_funnel_submissions.$inferSelect,
): Promise<void> {
  const firstName = sub.submitted_name.split(" ")[0] || sub.submitted_name;
  await sendSms({
    to: sub.submitted_phone,
    body: `Hey ${firstName}, saw you started looking at a trial shoot — anything I can help with? — Andy`,
    submissionId: sub.id,
    dealId: sub.deal_id,
    purpose: "intro_funnel_abandon_15m",
  });
}

async function send24hSmsAndEmail(
  sub: typeof intro_funnel_submissions.$inferSelect,
): Promise<void> {
  const firstName = sub.submitted_name.split(" ")[0] || sub.submitted_name;
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL}/lite/intro/${sub.token}`;

  await sendSms({
    to: sub.submitted_phone,
    body: `Hey ${firstName} — your trial shoot portal is still there if you want to pick up where you left off. ${portalLink} — Andy`,
    submissionId: sub.id,
    dealId: sub.deal_id,
    purpose: "intro_funnel_abandon_24h",
  });

  const { subject, body } = await generateAbandonEmail(sub, "24h");

  await sendEmail({
    to: sub.submitted_email,
    subject,
    body,
    classification: "intro_funnel_abandon_24h",
    purpose: "intro_funnel_abandon_24h_email",
    tags: [{ name: "funnel", value: "abandon_24h" }],
  });
}

async function send3dEmail(
  sub: typeof intro_funnel_submissions.$inferSelect,
): Promise<void> {
  const { subject, body } = await generateAbandonEmail(sub, "3d");

  await sendEmail({
    to: sub.submitted_email,
    subject,
    body,
    classification: "intro_funnel_abandon_3d",
    purpose: "intro_funnel_abandon_3d_email",
    tags: [{ name: "funnel", value: "abandon_3d" }],
  });
}

async function demoteToLost(
  sub: typeof intro_funnel_submissions.$inferSelect,
): Promise<void> {
  const nowMs = Date.now();

  await db
    .update(intro_funnel_submissions)
    .set({
      abandon_sequence_state: "demoted",
      updated_at_ms: nowMs,
    })
    .where(eq(intro_funnel_submissions.id, sub.id));

  await db
    .update(deals)
    .set({
      stage: "lost",
      loss_reason: "intro_funnel_abandoned",
      updated_at_ms: nowMs,
    })
    .where(eq(deals.id, sub.deal_id));

  await logActivity({
    dealId: sub.deal_id,
    kind: "intro_funnel_abandoned",
    body: "Prospect demoted to Lost after abandon sequence completed",
    meta: {
      submission_id: sub.id,
      elapsed_since_creation_ms: nowMs - sub.created_at_ms,
    },
  });
}

async function updateAbandonState(
  submissionId: string,
  dealId: string,
  newState: AbandonSequenceState,
  activityKind: string,
): Promise<void> {
  await db
    .update(intro_funnel_submissions)
    .set({
      abandon_sequence_state: newState,
      updated_at_ms: Date.now(),
    })
    .where(eq(intro_funnel_submissions.id, submissionId));

  await logActivity({
    dealId,
    kind: activityKind as never,
    body: `Abandon sequence advanced to ${newState}`,
    meta: { submission_id: submissionId },
  });
}

interface AbandonEmailContent {
  subject: string;
  body: string;
}

async function generateAbandonEmail(
  sub: typeof intro_funnel_submissions.$inferSelect,
  stage: "24h" | "3d",
): Promise<AbandonEmailContent> {
  if (!killSwitches.llm_calls_enabled) {
    return getAbandonEmailFallback(sub, stage);
  }

  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL}/lite/intro/${sub.token}`;
  const firstName = sub.submitted_name.split(" ")[0] || sub.submitted_name;
  const answers = sub.questionnaire_answers_json as Record<string, unknown> | null;

  const promptDirection =
    stage === "24h"
      ? "Write a one-paragraph follow-up email to someone who started booking a trial shoot with SuperBad Marketing but didn't finish. " +
        "Voice: Andy's voice — direct, warm, no pressure. One paragraph. End with a portal link, no hard CTA. " +
        'Never use: "just checking in", "following up", "don\'t miss out", "limited spots". ' +
        "Do: acknowledge they were interested, make it easy to come back, leave the door open."
      : "Write a short final follow-up email. This is the last time SuperBad will reach out about the trial shoot. " +
        "The person started but didn't finish booking. " +
        "Voice: honest, warm, no pitch. Reframe why it might be worth 15 minutes of their time. " +
        'Close with "if now\'s not the right time, no worries" energy. One paragraph plus a closing line. ' +
        'Never beg. Never create urgency. Never reference "last chance."';

  const prompt = `${promptDirection}

Prospect: ${sub.submitted_name} (business: ${sub.submitted_business_name}, type: ${sub.shape.replace(/_/g, " ")})
${answers ? `Questionnaire answers so far: ${JSON.stringify(answers)}` : "No questionnaire answers yet."}

Portal link: ${portalLink}

Respond with JSON only:
{
  "subject": "<short email subject line>",
  "body": "<email body as plain text, sign off as Andy>"
}`;

  try {
    const text = await invokeLlmText({
      job: "intro-funnel-abandon-email",
      prompt,
      maxTokens: 512,
    });

    const cleaned = text
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(cleaned) as {
      subject?: string;
      body?: string;
    };

    if (!parsed.subject || !parsed.body) {
      return getAbandonEmailFallback(sub, stage);
    }

    const brandProfile = await getSuperbadBrandProfile();
    const driftResult = await checkBrandVoiceDrift(parsed.body, brandProfile);

    if (!driftResult.pass) {
      return getAbandonEmailFallback(sub, stage);
    }

    return { subject: parsed.subject, body: parsed.body };
  } catch {
    return getAbandonEmailFallback(sub, stage);
  }
}

function getAbandonEmailFallback(
  sub: typeof intro_funnel_submissions.$inferSelect,
  stage: "24h" | "3d",
): AbandonEmailContent {
  const firstName = sub.submitted_name.split(" ")[0] || sub.submitted_name;
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL}/lite/intro/${sub.token}`;

  if (stage === "24h") {
    return {
      subject: "Still thinking about it?",
      body:
        `Hey ${firstName},\n\n` +
        "You started looking at a trial shoot and didn't finish — no worries, your portal's still there whenever you're ready.\n\n" +
        `${portalLink}\n\n` +
        "— Andy",
    };
  }

  return {
    subject: "No pressure",
    body:
      `Hey ${firstName},\n\n` +
      "Last note from me about this — if the timing's not right, genuinely no stress. " +
      "But if you've been meaning to get around to it, 15 minutes is all the portal takes.\n\n" +
      "If now's not the time, no worries. We'll be here.\n\n" +
      `${portalLink}\n\n` +
      "— Andy",
  };
}
