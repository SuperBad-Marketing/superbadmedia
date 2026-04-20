import { eq } from "drizzle-orm";

import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import {
  finance_snapshots,
  type FinanceMetrics,
  type FinanceProjection,
} from "@/lib/db/schema/finance-snapshots";
import { invokeLlmText } from "@/lib/ai/invoke";
import {
  buildNarrativePrompt,
  type NarrativeCallout,
  type NarrativeOutput,
} from "@/lib/finance/narrative-prompt";

function detectCallouts(metrics: FinanceMetrics): NarrativeCallout[] {
  const callouts: NarrativeCallout[] = [];
  if (metrics.yours_to_spend_cents < 0) {
    callouts.push("tax_tight");
  }
  if (metrics.outstanding_invoices_cents > 500000) {
    callouts.push("overdue_heavy");
  }
  if (metrics.net_cents > 0 && metrics.revenue_mtd_cents > 0) {
    // first_profitable_month is only meaningful in context — simplified check
  }
  return callouts;
}

const handleFinanceNarrativeRegenerate: TaskHandler = async (task) => {
  const payload = task.payload as { snapshot_date: string } | null;
  if (!payload?.snapshot_date) return;

  const rows = await db
    .select()
    .from(finance_snapshots)
    .where(eq(finance_snapshots.snapshot_date, payload.snapshot_date))
    .limit(1);

  const snapshot = rows[0];
  if (!snapshot) return;

  const metrics = snapshot.metrics_json as unknown as FinanceMetrics;
  const projection = snapshot.projection_json as unknown as FinanceProjection;

  if (!metrics || !projection) return;

  const thirtyDaysAgo = new Date(
    new Date(payload.snapshot_date + "T00:00:00").getTime() - 30 * 86_400_000,
  )
    .toISOString()
    .slice(0, 10);

  const compareRows = await db
    .select()
    .from(finance_snapshots)
    .where(eq(finance_snapshots.snapshot_date, thirtyDaysAgo))
    .limit(1);

  const compareSnapshot = compareRows[0] ?? null;
  const compareData = compareSnapshot
    ? {
        metrics: compareSnapshot.metrics_json as unknown as FinanceMetrics,
        projection: compareSnapshot.projection_json as unknown as FinanceProjection,
      }
    : null;

  const callouts = detectCallouts(metrics);

  const prompt = buildNarrativePrompt({
    snapshot_today: { metrics, projection },
    snapshot_compare: compareData,
    range_label: "This Month",
    callouts,
  });

  const raw = await invokeLlmText({
    job: "finance-draft-narrative",
    prompt,
    maxTokens: 1024,
  });

  let parsed: NarrativeOutput | null = null;
  try {
    parsed = JSON.parse(raw) as NarrativeOutput;
  } catch {
    parsed = null;
  }

  if (parsed && validateNarrativeOutput(parsed)) {
    await db
      .update(finance_snapshots)
      .set({
        narrative_text: JSON.stringify(parsed),
        narrative_generated_at_ms: Date.now(),
        narrative_callouts: (callouts.length > 0 ? callouts : null) as unknown as null,
      })
      .where(eq(finance_snapshots.snapshot_date, payload.snapshot_date));
  } else {
    await db
      .update(finance_snapshots)
      .set({
        narrative_text: JSON.stringify({
          paragraph_text: "",
          number_references: [],
          callout_used: null,
          _fallback: true,
        }),
        narrative_generated_at_ms: Date.now(),
        narrative_callouts: (callouts.length > 0 ? callouts : null) as unknown as null,
      })
      .where(eq(finance_snapshots.snapshot_date, payload.snapshot_date));
  }
};

function validateNarrativeOutput(output: NarrativeOutput): boolean {
  if (!output.paragraph_text || typeof output.paragraph_text !== "string") return false;
  if (!Array.isArray(output.number_references)) return false;
  for (const ref of output.number_references) {
    if (typeof ref.token !== "string") return false;
    if (typeof ref.value_aud !== "number") return false;
    if (typeof ref.link_path !== "string") return false;
  }
  return true;
}

export const FINANCE_NARRATIVE_HANDLERS: HandlerMap = {
  finance_narrative_regenerate: handleFinanceNarrativeRegenerate,
};
