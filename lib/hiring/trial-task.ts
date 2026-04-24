/**
 * Trial task authoring + send flow.
 *
 * Spec: hiring-pipeline §9.1–9.3.
 * Owner: HP-9.
 *
 * On Screened → Trial transition, Andy clicks "Author trial task":
 * 1. Lite fetches claimable backlog from Content Engine.
 * 2. LLM (Sonnet) proposes a task from the backlog matched to the candidate.
 * 3. Andy confirms / edits / overrides.
 * 4. On confirm: claim the content item, send the trial brief email,
 *    create the trial_tasks row, transition candidate to Trial.
 */

import { randomUUID } from "node:crypto";
import settings from "@/lib/settings";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildTrialTaskAuthorPrompt,
  buildTrialTaskAuthorSystem,
  type TrialTaskAuthorPromptInput,
} from "@/lib/ai/prompts/hiring/trial-task-author";
import {
  listClaimableContentItems,
  claimInternalContentItem,
} from "@/lib/content-engine/claimable-items";
import {
  getCandidateById,
  getRoleBriefById,
  createTrialTask,
} from "@/lib/hiring/queries";
import { transitionCandidateStage } from "@/lib/hiring/transition-candidate-stage";
import { sendEmail } from "@/lib/channels/email";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import type { PortfolioSignal } from "@/lib/hiring/portfolio";
import type { CandidateRow } from "@/lib/db/schema/candidates";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";
import type { TrialTaskRow } from "@/lib/db/schema/trial-tasks";

// ── Types ──────────────────────────────────────────────────────────────

export interface TrialTaskProposal {
  contentItemId: string;
  contentItemKeyword: string;
  rationale: string;
  taskDescription: string;
  budgetCapHours: number;
  deliverableFormat: string;
}

export interface ProposeTrialTaskResult {
  ok: true;
  proposal: TrialTaskProposal;
  candidateName: string;
  roleName: string;
  candidateRate: number | null;
  candidateRateUnit: string | null;
  budgetCapAud: number;
  deadlineDays: number;
}

export interface ProposeTrialTaskError {
  ok: false;
  reason: string;
}

export interface ConfirmTrialTaskInput {
  candidateId: string;
  contentItemId: string;
  taskDescription: string;
  budgetCapAud: number;
  ratePerUnitAud: number;
  rateUnit: string;
  deadlineDays: number;
  by: string;
}

export interface ConfirmTrialTaskResult {
  ok: true;
  trialTask: TrialTaskRow;
}

export interface ConfirmTrialTaskError {
  ok: false;
  reason: string;
}

// ── Propose ────────────────────────────────────────────────────────────

export async function proposeTrialTask(
  candidateId: string,
): Promise<ProposeTrialTaskResult | ProposeTrialTaskError> {
  const candidate = await getCandidateById(candidateId);
  if (!candidate) return { ok: false, reason: "Candidate not found." };
  if (candidate.stage !== "screened") {
    return { ok: false, reason: `Candidate is in stage '${candidate.stage}', must be 'screened'.` };
  }
  if (!candidate.role_brief_id) {
    return { ok: false, reason: "Candidate has no linked Role Brief." };
  }

  const brief = await getRoleBriefById(candidate.role_brief_id);
  if (!brief) return { ok: false, reason: "Role Brief not found." };

  const companyId = "superbad";
  const backlogItems = await listClaimableContentItems({
    suitableFor: "trial_task",
    limit: 10,
    companyId,
  });

  if (backlogItems.length === 0) {
    return { ok: false, reason: "No claimable content items available for trial tasks." };
  }

  const signal = candidate.portfolio_signal_json as PortfolioSignal | null;
  const styleTags = signal?.extracted_tags ?? [];
  const portfolioSummary = signal?.bio ?? null;

  const defaultBudgetCapHours = await settings.get("hiring.trial.default_budget_cap_hours");
  const deadlineDays = await settings.get("hiring.trial.delivery_deadline_days");

  const promptInput: TrialTaskAuthorPromptInput = {
    candidateName: candidate.name,
    candidateStyleTags: styleTags,
    candidatePortfolioSummary: portfolioSummary,
    candidateRateAud: candidate.rate_expectation_aud,
    candidateRateUnit: candidate.rate_expectation_unit,
    roleName: brief.role_name,
    roleStyleSummary: brief.style_summary ?? null,
    roleExtractedTags: safeJsonArray(brief.extracted_tags_json),
    backlogItems,
    defaultBudgetCapHours,
  };

  const raw = await invokeLlmText({
    job: "hiring-trial-task-author",
    prompt: buildTrialTaskAuthorPrompt(promptInput),
    system: buildTrialTaskAuthorSystem(),
    maxTokens: 1024,
  });

  const parsed = parseProposalResponse(raw, backlogItems);
  if (!parsed.ok) return parsed;

  const rateAud = candidate.rate_expectation_aud ?? 0;
  const budgetCapAud = rateAud > 0
    ? rateAud * parsed.proposal.budgetCapHours
    : parsed.proposal.budgetCapHours * 80;

  return {
    ok: true,
    proposal: parsed.proposal,
    candidateName: candidate.name,
    roleName: brief.role_name,
    candidateRate: candidate.rate_expectation_aud,
    candidateRateUnit: candidate.rate_expectation_unit,
    budgetCapAud,
    deadlineDays,
  };
}

// ── Confirm + Send ─────────────────────────────────────────────────────

export async function confirmAndSendTrialTask(
  input: ConfirmTrialTaskInput,
): Promise<ConfirmTrialTaskResult | ConfirmTrialTaskError> {
  const candidate = await getCandidateById(input.candidateId);
  if (!candidate) return { ok: false, reason: "Candidate not found." };
  if (candidate.stage !== "screened") {
    return { ok: false, reason: `Candidate is in stage '${candidate.stage}', must be 'screened'.` };
  }
  if (!candidate.email) {
    return { ok: false, reason: "Candidate has no email address." };
  }
  if (!candidate.role_brief_id) {
    return { ok: false, reason: "Candidate has no linked Role Brief." };
  }

  const claimResult = await claimInternalContentItem(
    input.contentItemId,
    input.candidateId,
    input.budgetCapAud,
  );
  if (!claimResult.ok) {
    return { ok: false, reason: `Content item claim failed: ${claimResult.reason}.` };
  }

  const nowMs = Date.now();
  const dueAtMs = nowMs + input.deadlineDays * 24 * 60 * 60 * 1000;

  const trialTask = await createTrialTask({
    candidate_id: input.candidateId,
    role_brief_id: candidate.role_brief_id,
    internal_content_ref: input.contentItemId,
    task_description: input.taskDescription,
    budget_cap_aud: input.budgetCapAud,
    rate_per_unit_aud: input.ratePerUnitAud,
    rate_unit: input.rateUnit,
    due_at_ms: dueAtMs,
  });

  transitionCandidateStage(input.candidateId, "trial", {
    by: input.by,
    meta: { trial_task_id: trialTask.id, content_item_id: input.contentItemId },
  });

  const firstName = candidate.name.split(" ")[0];
  const dueDate = new Date(dueAtMs).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  await sendEmail({
    to: candidate.email,
    subject: `Trial task — ${firstName}`,
    body: buildTrialEmailBody(firstName, input.taskDescription, input.budgetCapAud, dueDate),
    classification: "hiring_trial_send",
    purpose: `Trial task sent to ${candidate.name}`,
    tags: [
      { name: "candidate_id", value: input.candidateId },
      { name: "trial_task_id", value: trialTask.id },
    ],
  });

  await logActivity({
    kind: "candidate_trial_sent",
    body: `Trial task sent to ${candidate.name}: "${input.taskDescription.slice(0, 80)}…"`,
    meta: {
      candidate_id: input.candidateId,
      trial_task_id: trialTask.id,
      content_item_id: input.contentItemId,
      budget_cap_aud: input.budgetCapAud,
      due_at_ms: dueAtMs,
    },
    createdBy: input.by,
  });

  const graceDays = await settings.get("hiring.trial.delivery_grace_days");
  const overdueAtMs = dueAtMs + graceDays * 24 * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "hiring_trial_task_overdue",
    runAt: overdueAtMs,
    payload: { trial_task_id: trialTask.id, candidate_id: input.candidateId },
    idempotencyKey: `trial-overdue-${trialTask.id}`,
  });

  return { ok: true, trialTask };
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildTrialEmailBody(
  firstName: string,
  taskDescription: string,
  budgetCapAud: number,
  dueDate: string,
): string {
  return `<p style="margin: 0 0 18px; line-height: 1.65; color: #e8e0d0;">Hey ${firstName},</p>

<p style="margin: 0 0 18px; line-height: 1.65; color: #e8e0d0;">Got a piece of real work for you — not a made-up test. If it's good enough, it goes live.</p>

<h3 style="margin: 24px 0 8px; font-size: 15px; font-weight: 600; color: #FDF5E6;">The brief</h3>
<p style="margin: 0 0 18px; line-height: 1.65; color: #e8e0d0;">${taskDescription}</p>

<h3 style="margin: 24px 0 8px; font-size: 15px; font-weight: 600; color: #FDF5E6;">The deal</h3>
<ul style="padding-left: 20px; color: #e8e0d0; line-height: 1.65;">
  <li>Budget cap: <strong style="color: #FDF5E6;">$${budgetCapAud} AUD</strong></li>
  <li>Due: <strong style="color: #FDF5E6;">${dueDate}</strong></li>
  <li>Deliver via reply to this email with a link (Dropbox, Google Drive, WeTransfer — whatever works)</li>
</ul>

<p style="margin: 0 0 18px; line-height: 1.65; color: #e8e0d0;">If you need to bail or need more time, just reply and say so. No drama.</p>

<p style="margin: 0; line-height: 1.55; color: rgba(253,245,230,0.5); font-size: 13px;">— SuperBad</p>`;
}

function safeJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === "string");
  return [];
}

interface ParsedProposal {
  ok: true;
  proposal: TrialTaskProposal;
}

function parseProposalResponse(
  raw: string,
  backlogItems: { id: string; keyword: string }[],
): ParsedProposal | ProposeTrialTaskError {
  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.no_match) {
      return { ok: false, reason: parsed.reason ?? "LLM found no suitable backlog item." };
    }

    const contentItemId = parsed.content_item_id;
    if (!contentItemId) {
      return { ok: false, reason: "LLM response missing content_item_id." };
    }

    const matched = backlogItems.find((item) => item.id === contentItemId);
    if (!matched) {
      return { ok: false, reason: `LLM proposed item '${contentItemId}' which is not in the available backlog.` };
    }

    return {
      ok: true,
      proposal: {
        contentItemId,
        contentItemKeyword: matched.keyword,
        rationale: parsed.rationale ?? "",
        taskDescription: parsed.task_description ?? "",
        budgetCapHours: typeof parsed.budget_cap_hours === "number" ? parsed.budget_cap_hours : 4,
        deliverableFormat: parsed.deliverable_format ?? "",
      },
    };
  } catch {
    return { ok: false, reason: "Failed to parse LLM response as JSON." };
  }
}
