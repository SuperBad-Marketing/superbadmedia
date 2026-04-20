/**
 * Prompt builder for trial task authoring from Content Engine backlog.
 *
 * Spec: hiring-pipeline §9.1.
 * Model: hiring-trial-task-author (Sonnet).
 */

import type { PortfolioSignal } from "@/lib/hiring/portfolio";
import type { ContentBacklogItem } from "@/lib/content-engine/claimable-items";

export interface TrialTaskAuthorPromptInput {
  candidateName: string;
  candidateStyleTags: string[];
  candidatePortfolioSummary: string | null;
  candidateRateAud: number | null;
  candidateRateUnit: string | null;
  roleName: string;
  roleStyleSummary: string | null;
  roleExtractedTags: string[];
  backlogItems: ContentBacklogItem[];
  defaultBudgetCapHours: number;
}

export function buildTrialTaskAuthorPrompt(
  input: TrialTaskAuthorPromptInput,
): string {
  const backlogSection = input.backlogItems
    .map(
      (item, i) =>
        `${i + 1}. [${item.id}] "${item.keyword}" (rankability: ${item.rankabilityScore ?? "unknown"}, status: ${item.status})` +
        (item.outline
          ? `\n   Outline: ${typeof item.outline === "string" ? item.outline : JSON.stringify(item.outline)}`
          : ""),
    )
    .join("\n");

  const rateSection =
    input.candidateRateAud && input.candidateRateUnit
      ? `Rate: $${input.candidateRateAud}/${input.candidateRateUnit}`
      : "Rate: not specified";

  return `You are assigning a paid trial task to a creative contractor candidate. The task must come from SuperBad's internal content backlog — real work that will be used if the quality is good enough.

## Candidate
Name: ${input.candidateName}
${rateSection}
${input.candidatePortfolioSummary ? `Portfolio summary: ${input.candidatePortfolioSummary}` : ""}
${input.candidateStyleTags.length > 0 ? `Style tags from their work: ${input.candidateStyleTags.join(", ")}` : ""}

## Role
Role: ${input.roleName}
${input.roleStyleSummary ? `Style summary: ${input.roleStyleSummary}` : ""}
${input.roleExtractedTags.length > 0 ? `Role tags: ${input.roleExtractedTags.join(", ")}` : ""}

## Available content backlog items
${backlogSection || "No items available."}

## Instructions
Pick ONE backlog item that:
1. Matches the candidate's visible strengths (give them something they'll nail).
2. Stretches them slightly toward what the role actually needs (test an edge).
3. Is non-client-facing internal content (social posts, blog drafts, brand content).

Respond in JSON with exactly these fields:
{
  "content_item_id": "<the item ID from the list>",
  "rationale": "<2-3 sentences: why this item for this candidate — what strength it leverages and what edge it tests>",
  "task_description": "<clear brief for the candidate: what to produce, key constraints, deliverable format>",
  "budget_cap_hours": <number of hours, default ${input.defaultBudgetCapHours}>,
  "deliverable_format": "<e.g. 'MP4, 1080p, 60-90 seconds' or 'Blog draft, 800-1200 words, Markdown'>"
}

Rules:
- Budget cap defaults to ${input.defaultBudgetCapHours} hours unless the task clearly needs more or less.
- Task description must be specific enough for the candidate to start without asking questions.
- Rationale must reference specific things from the candidate's portfolio.
- If no backlog items are suitable, respond with: { "no_match": true, "reason": "<why>" }
- JSON only. No markdown fences. No preamble.`;
}

export function buildTrialTaskAuthorSystem(): string {
  return "You are a creative director at a boutique marketing agency assigning trial work. Match the task to the candidate's strengths while testing one growth edge. Be specific and practical — this is real work, not a test prompt.";
}
