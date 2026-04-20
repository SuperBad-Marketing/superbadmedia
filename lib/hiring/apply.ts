/**
 * Apply-form business logic — processes inbound applications, generates
 * LLM follow-up questions, and sends the follow-up email.
 *
 * Spec: hiring-pipeline §7.
 * Owner: HP-7.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  candidates,
  type CandidateRow,
} from "@/lib/db/schema/candidates";
import {
  createCandidate,
  updateCandidate,
  getCandidateById,
  type CreateCandidateInput,
} from "./queries";
import { getRoleBriefById } from "./queries";
import { ingestPortfolioUrl, type PortfolioSignal } from "./portfolio";
import { scoreCandidateAgainstBriefs } from "./score-candidate";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildFollowupQuestionPrompt,
  buildFollowupQuestionSystem,
  type FollowupQuestionPromptInput,
} from "@/lib/ai/prompts/hiring/followup-question-draft";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";
import { killSwitches } from "@/lib/kill-switches";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApplyFormInput {
  name: string;
  email: string;
  roleBriefId: string | null;
  portfolioUrls: string[];
  locationCity: string;
  rateExpectationBand: string;
  availabilityHoursPerWeek: number;
  availableFromMs: number | null;
  recommendSomeone: string | null;
}

export interface ApplyFormResult {
  ok: boolean;
  candidateId?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Process application
// ---------------------------------------------------------------------------

const FOLLOWUP_DELAY_MS = 2 * 60 * 1000;

export async function processApplication(
  input: ApplyFormInput,
): Promise<ApplyFormResult> {
  const normalizedEmail = input.email.toLowerCase().trim();

  const existing = await findCandidateByEmail(normalizedEmail);

  let candidate: CandidateRow;

  if (existing && (existing.stage === "sourced" || existing.stage === "invited")) {
    candidate = await updateCandidate(existing.id, {
      stage: "applied",
      name: input.name,
      role_brief_id: input.roleBriefId ?? existing.role_brief_id,
      location_city: input.locationCity || existing.location_city,
      portfolio_urls_json: input.portfolioUrls,
      rate_expectation_aud: parseRateBand(input.rateExpectationBand),
      rate_expectation_unit: "per_hour",
      availability_hours_per_week: input.availabilityHoursPerWeek,
      available_from_ms: input.availableFromMs ?? existing.available_from_ms,
      followup_status: "pending",
    });
  } else {
    candidate = await createCandidate({
      name: input.name,
      email: normalizedEmail,
      stage: "applied",
      source: "applied",
      role_brief_id: input.roleBriefId,
      location_city: input.locationCity,
      portfolio_urls_json: input.portfolioUrls,
      rate_expectation_aud: parseRateBand(input.rateExpectationBand),
      rate_expectation_unit: "per_hour",
      availability_hours_per_week: input.availabilityHoursPerWeek,
      available_from_ms: input.availableFromMs,
    });
    candidate = await updateCandidate(candidate.id, { followup_status: "pending" });
  }

  await logActivity({
    kind: "candidate_applied",
    body: `${input.name} applied${input.roleBriefId ? "" : " (general interest)"}.`,
    meta: {
      candidate_id: candidate.id,
      source: existing ? "matched_existing" : "new",
      role_brief_id: input.roleBriefId,
    },
  });

  if (input.recommendSomeone) {
    await processReferrals(input.recommendSomeone, input.roleBriefId);
  }

  await enqueueTask({
    task_type: "hiring_apply_followup_send",
    runAt: Date.now() + FOLLOWUP_DELAY_MS,
    payload: { candidate_id: candidate.id },
    idempotencyKey: `hiring_apply_followup:${candidate.id}`,
  });

  return { ok: true, candidateId: candidate.id };
}

// ---------------------------------------------------------------------------
// Follow-up question generation + send
// ---------------------------------------------------------------------------

export async function generateAndSendFollowup(
  candidateId: string,
): Promise<void> {
  const candidate = await getCandidateById(candidateId);
  if (!candidate || candidate.stage !== "applied") return;
  if (!candidate.email) return;
  if (candidate.application_followup_question) return;

  const portfolioUrls = Array.isArray(candidate.portfolio_urls_json)
    ? (candidate.portfolio_urls_json as string[])
    : [];

  let signal: PortfolioSignal | null = null;
  if (portfolioUrls.length > 0) {
    signal = await ingestPortfolioUrl(portfolioUrls[0]);
    if (signal) {
      await updateCandidate(candidateId, {
        portfolio_signal_json: JSON.parse(JSON.stringify(signal)),
        portfolio_signal_fetched_at_ms: Date.now(),
      });

      if (candidate.role_brief_id) {
        const brief = await getRoleBriefById(candidate.role_brief_id);
        if (brief) {
          const scores = await scoreCandidateAgainstBriefs(signal, [brief]);
          if (scores.length > 0) {
            await updateCandidate(candidateId, {
              brief_match_score: scores[0].score,
            });
          }
        }
      }
    }
  }

  const brief = candidate.role_brief_id
    ? await getRoleBriefById(candidate.role_brief_id)
    : null;

  const styleTags: string[] = signal?.extracted_tags ?? [];
  const briefTags: string[] = Array.isArray(brief?.extracted_tags_json)
    ? (brief.extracted_tags_json as string[])
    : [];

  const promptInput: FollowupQuestionPromptInput = {
    candidateName: candidate.name,
    roleName: brief?.role_name ?? "General interest",
    portfolioUrls,
    portfolioStyleTags: styleTags,
    portfolioSummary: signal?.bio ?? null,
    locationCity: candidate.location_city,
    rateExpectation: candidate.rate_expectation_aud
      ? `$${candidate.rate_expectation_aud}/hr`
      : null,
    availabilityHoursPerWeek: candidate.availability_hours_per_week,
    briefStyleSummary: brief?.style_summary ?? null,
    briefExtractedTags: briefTags,
  };

  const question = await invokeLlmText({
    job: "hiring-followup-question-draft",
    prompt: buildFollowupQuestionPrompt(promptInput),
    system: buildFollowupQuestionSystem(),
    maxTokens: 100,
  });

  const trimmedQuestion = question.trim().replace(/^["']|["']$/g, "");
  if (!trimmedQuestion) return;

  await updateCandidate(candidateId, {
    application_followup_question: trimmedQuestion,
  });

  await sendEmail({
    to: candidate.email,
    subject: `Quick question about your application${brief ? ` — ${brief.role_name}` : ""}`,
    body: buildFollowupEmailBody(candidate.name, trimmedQuestion),
    classification: "hiring_followup_question",
    purpose: `Follow-up question for applicant ${candidate.name}`,
    tags: [
      { name: "candidate_id", value: candidateId },
      { name: "type", value: "hiring_followup" },
    ],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findCandidateByEmail(
  email: string,
): Promise<CandidateRow | undefined> {
  const rows = await db
    .select()
    .from(candidates)
    .where(eq(candidates.email, email))
    .limit(1)
    .all();
  return rows[0];
}

function parseRateBand(band: string): number | null {
  const match = band.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function buildFollowupEmailBody(name: string, question: string): string {
  const firstName = name.split(" ")[0];
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1A1A18; max-width: 520px;">
  <p>Hey ${firstName},</p>
  <p>Thanks for putting your hand up. Had a look through your work — one thing I wanted to ask:</p>
  <p style="font-style: italic; color: #332F2A;">${question}</p>
  <p>No rush. Just reply to this email whenever.</p>
  <p style="color: #807F73; font-size: 14px; margin-top: 32px;">SuperBad</p>
</div>`;
}

async function processReferrals(
  freeText: string,
  roleBriefId: string | null,
): Promise<void> {
  const urlPattern = /https?:\/\/[^\s,;)]+/gi;
  const urls = freeText.match(urlPattern);
  if (!urls || urls.length === 0) return;

  for (const url of urls.slice(0, 3)) {
    await createCandidate({
      name: `Referral (${new URL(url).hostname})`,
      stage: "sourced",
      source: "referred",
      role_brief_id: roleBriefId,
      portfolio_urls_json: [url],
    });
  }
}
