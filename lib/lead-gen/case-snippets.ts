import { randomUUID } from "node:crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  caseSnippets,
  type CaseSnippetMilestoneType,
} from "@/lib/db/schema/case-snippets";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { settingsRegistry } from "@/lib/settings";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

export interface MilestoneContext {
  shootFeedback?: string;
  sixWeekPlanSummary?: string;
  clientContextSummary?: string;
  deliverablesCompleted?: number;
  auditScores?: Record<string, string>;
}

export interface GenerateCaseSnippetInput {
  companyId: string;
  milestoneType: CaseSnippetMilestoneType;
  brandDnaSummary: string;
  context: MilestoneContext;
  vertical: string;
  location?: string;
}

export interface CaseSnippetResult {
  headline: string;
  paragraph: string;
  metricsLine: string | null;
}

export async function generateCaseSnippet(
  input: GenerateCaseSnippetInput,
  dbInstance = defaultDb,
): Promise<{ ok: true; snippetId: string } | { ok: false; reason: string }> {
  if (!killSwitches.llm_calls_enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const systemPrompt = `You draft anonymised case snippets for cold outreach emails.
Rules:
- No company names, individual names, or identifying details.
- Use vertical + location + outcome only.
- Headline: short label, e.g. "Medical aesthetics — Melbourne".
- Paragraph: 2–3 sentences describing real, specific outcomes.
- Metrics line: only if real data exists. Format like "Social presence: D → B+ over 90 days". Output null if no metrics.
Respond in JSON: { "headline": string, "paragraph": string, "metrics_line": string | null }`;

  const contextParts: string[] = [
    `Vertical: ${input.vertical}`,
    `Milestone: ${input.milestoneType}`,
  ];
  if (input.location) contextParts.push(`Location: ${input.location}`);
  if (input.brandDnaSummary)
    contextParts.push(`Brand DNA summary:\n${input.brandDnaSummary}`);
  if (input.context.shootFeedback)
    contextParts.push(`Shoot feedback:\n${input.context.shootFeedback}`);
  if (input.context.sixWeekPlanSummary)
    contextParts.push(`Six-week plan:\n${input.context.sixWeekPlanSummary}`);
  if (input.context.clientContextSummary)
    contextParts.push(
      `Client context:\n${input.context.clientContextSummary}`,
    );
  if (input.context.deliverablesCompleted != null)
    contextParts.push(
      `Deliverables completed: ${input.context.deliverablesCompleted}`,
    );
  if (input.context.auditScores) {
    const lines = Object.entries(input.context.auditScores)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    contextParts.push(`Audit scores:\n${lines}`);
  }

  let rawResponse: string;
  try {
    rawResponse = await invokeLlmText({
      job: "lead-gen-case-snippet",
      system: systemPrompt,
      prompt: contextParts.join("\n\n"),
      maxTokens: 512,
    });
  } catch {
    return { ok: false, reason: "generation_failed" };
  }

  let parsed: CaseSnippetResult;
  try {
    const json = JSON.parse(rawResponse);
    parsed = {
      headline: String(json.headline),
      paragraph: String(json.paragraph),
      metricsLine: json.metrics_line != null ? String(json.metrics_line) : null,
    };
  } catch {
    return { ok: false, reason: "parse_failed" };
  }

  const snippetId = randomUUID();
  const now = new Date();

  await dbInstance.insert(caseSnippets).values({
    id: snippetId,
    company_id: input.companyId,
    milestone_type: input.milestoneType,
    vertical: input.vertical,
    location: input.location ?? null,
    headline: parsed.headline,
    paragraph: parsed.paragraph,
    metrics_line: parsed.metricsLine,
    status: "pending",
    created_at: now,
  });

  const autoApproveHours = await settingsRegistry.get(
    "snippet.auto_approve_hours",
  );
  await enqueueTask({
    task_type: "case_snippet_auto_approve",
    runAt: new Date(now.getTime() + autoApproveHours * 60 * 60 * 1000),
    payload: { snippet_id: snippetId },
    idempotencyKey: `case_snippet_auto_approve:${snippetId}`,
  });

  await logActivity({
    kind: "case_snippet_drafted",
    body: `Case snippet drafted: ${parsed.headline}`,
    meta: {
      snippet_id: snippetId,
      company_id: input.companyId,
      milestone_type: input.milestoneType,
      vertical: input.vertical,
    },
  });

  return { ok: true, snippetId };
}

export async function approveCaseSnippet(
  snippetId: string,
  dbInstance = defaultDb,
): Promise<void> {
  const now = new Date();
  await dbInstance
    .update(caseSnippets)
    .set({ status: "approved", approved_at: now })
    .where(
      and(eq(caseSnippets.id, snippetId), eq(caseSnippets.status, "pending")),
    );

  await logActivity({
    kind: "case_snippet_approved",
    body: `Case snippet approved`,
    meta: { snippet_id: snippetId },
  });
}

export async function rejectCaseSnippet(
  snippetId: string,
  dbInstance = defaultDb,
): Promise<void> {
  await dbInstance
    .update(caseSnippets)
    .set({ status: "rejected" })
    .where(
      and(eq(caseSnippets.id, snippetId), eq(caseSnippets.status, "pending")),
    );

  await logActivity({
    kind: "case_snippet_rejected",
    body: `Case snippet rejected`,
    meta: { snippet_id: snippetId },
  });
}

export async function autoApproveCaseSnippet(
  snippetId: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const [row] = await dbInstance
    .select({ status: caseSnippets.status })
    .from(caseSnippets)
    .where(eq(caseSnippets.id, snippetId))
    .limit(1);

  if (!row || row.status !== "pending") return false;

  const now = new Date();
  await dbInstance
    .update(caseSnippets)
    .set({ status: "approved", approved_at: now, auto_approved: true })
    .where(eq(caseSnippets.id, snippetId));

  await logActivity({
    kind: "case_snippet_auto_approved",
    body: `Case snippet auto-approved after review window`,
    meta: { snippet_id: snippetId },
  });

  return true;
}

export async function getBestMatchingSnippet(
  prospectVertical: string,
  dbInstance = defaultDb,
): Promise<{
  headline: string;
  paragraph: string;
  metricsLine: string | null;
} | null> {
  const [row] = await dbInstance
    .select({
      headline: caseSnippets.headline,
      paragraph: caseSnippets.paragraph,
      metrics_line: caseSnippets.metrics_line,
    })
    .from(caseSnippets)
    .where(eq(caseSnippets.status, "approved"))
    .orderBy(
      sql`CASE WHEN ${caseSnippets.vertical} = ${prospectVertical} THEN 0 ELSE 1 END`,
      desc(caseSnippets.created_at),
    )
    .limit(1);

  if (!row) return null;

  return {
    headline: row.headline,
    paragraph: row.paragraph,
    metricsLine: row.metrics_line,
  };
}
