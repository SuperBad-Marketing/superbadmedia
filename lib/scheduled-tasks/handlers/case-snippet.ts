import type { HandlerMap } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { autoApproveCaseSnippet } from "@/lib/lead-gen/case-snippets";

async function handleAutoApprove(task: ScheduledTaskRow): Promise<void> {
  const payload = task.payload as { snippet_id?: string } | null;
  const snippetId = payload?.snippet_id;
  if (!snippetId) return;

  await autoApproveCaseSnippet(snippetId);
}

async function handleRetainer90d(task: ScheduledTaskRow): Promise<void> {
  // Stub: generates a case snippet for 90-day retainer milestone.
  // Full implementation requires Client Context + Brand DNA queries
  // that will be wired when those modules are built.
  const payload = task.payload as {
    company_id?: string;
    deal_id?: string;
  } | null;
  if (!payload?.company_id) return;

  // Imported lazily to avoid circular deps in handler registration
  const { generateCaseSnippet } = await import(
    "@/lib/lead-gen/case-snippets"
  );

  await generateCaseSnippet({
    companyId: payload.company_id,
    milestoneType: "retainer_90d",
    brandDnaSummary: "",
    context: {},
    vertical: "unknown",
  });
}

export const CASE_SNIPPET_HANDLERS: HandlerMap = {
  case_snippet_auto_approve: handleAutoApprove,
  case_snippet_retainer_90d: handleRetainer90d,
};
