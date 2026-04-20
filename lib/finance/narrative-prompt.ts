import type { FinanceMetrics, FinanceProjection } from "@/lib/db/schema/finance-snapshots";

export type NarrativeCallout =
  | "tax_tight"
  | "projection_cliff"
  | "overdue_heavy"
  | "first_profitable_month";

export interface NarrativeInput {
  snapshot_today: { metrics: FinanceMetrics; projection: FinanceProjection };
  snapshot_compare: { metrics: FinanceMetrics; projection: FinanceProjection } | null;
  range_label: string;
  callouts: NarrativeCallout[];
}

export interface NarrativeOutput {
  paragraph_text: string;
  number_references: Array<{ token: string; value_aud: number; link_path: string }>;
  callout_used: string | null;
}

function centsToAud(cents: number): string {
  const aud = Math.round(cents) / 100;
  if (Math.abs(aud) >= 1000) {
    return `$${(aud / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `$${aud.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

export function buildNarrativePrompt(input: NarrativeInput): string {
  const m = input.snapshot_today.metrics;
  const p = input.snapshot_today.projection;
  const prev = input.snapshot_compare?.metrics ?? null;

  const contracted90d = p.contracted_curve.reduce((s, d) => s + d.cents, 0);
  const pipelineWeighted90d = p.pipeline_weighted_curve.reduce((s, d) => s + d.cents, 0);

  const momDelta = prev
    ? ((m.revenue_mtd_cents - prev.revenue_mtd_cents) / Math.max(prev.revenue_mtd_cents, 1)) * 100
    : null;

  const calloutNotes = input.callouts.map((c) => {
    switch (c) {
      case "tax_tight":
        return `Yours-to-spend is ${centsToAud(m.yours_to_spend_cents)}. After GST (${centsToAud(m.gst_owed_cents)}) and income tax (${centsToAud(m.income_tax_provisioned_cents)}), the buffer is thin. Surface this as a dry observation, not alarm.`;
      case "projection_cliff":
        return "The 90-day projection shows a sharp revenue drop — commitments ending without replacements lined up.";
      case "overdue_heavy":
        return `Outstanding invoices at ${centsToAud(m.outstanding_invoices_cents)}. At least one is overdue. Note it matter-of-factly.`;
      case "first_profitable_month":
        return "Net is positive this month for the first time. Acknowledge it dryly — no celebration, just a nod.";
    }
  }).join("\n");

  return `You are SuperBad's finance narrator. Write a 3–5 sentence paragraph summarising the current financial state for the operator (Andy). Voice: dry, observational, self-deprecating. Short sentences. No advice, no "you should". Observations only.

Range: ${input.range_label}

Current snapshot:
- Revenue MTD: ${centsToAud(m.revenue_mtd_cents)}
- Expenses MTD: ${centsToAud(m.expenses_mtd_cents)}
- Net: ${centsToAud(m.net_cents)}
- MRR: ${centsToAud(m.mrr_cents)}
- Outstanding invoices: ${centsToAud(m.outstanding_invoices_cents)}
- GST owed (this BAS quarter): ${centsToAud(m.gst_owed_cents)}
- Income tax provisioned (YTD): ${centsToAud(m.income_tax_provisioned_cents)}
- Yours to spend: ${centsToAud(m.yours_to_spend_cents)}
- Stripe balance: ${centsToAud(m.stripe_balance_cents)}
- 90-day contracted revenue: ${centsToAud(contracted90d)}
- 90-day pipeline-weighted revenue: ${centsToAud(pipelineWeighted90d)}
${prev ? `- Month-over-month revenue delta: ${momDelta != null ? `${momDelta > 0 ? "+" : ""}${momDelta.toFixed(0)}%` : "n/a"}` : "- No prior month comparison available."}

${input.callouts.length > 0 ? `Callout signals (weave ONE into the narrative naturally):\n${calloutNotes}` : "No special callouts this period."}

RULES:
1. Every dollar figure you mention MUST appear in the number_references array with an exact matching value (in whole AUD, not cents).
2. For each number reference, provide a link_path pointing to the drill-down route:
   - Revenue → /lite/finance/mrr
   - Expenses → /lite/finance/expenses
   - Outstanding invoices → /lite/finance/outstanding
   - Projection figures → /lite/finance/mrr
   - Tax/GST/yours-to-spend → /lite/finance (stays on dashboard)
3. Never give advice. No "you should", "consider", "might want to". State facts.
4. Use one callout maximum. Pick the most material one.

Respond with ONLY valid JSON, no markdown fencing:
{
  "paragraph_text": "...",
  "number_references": [{ "token": "$12.4k", "value_aud": 12400, "link_path": "/lite/finance/mrr" }],
  "callout_used": "tax_tight" | null
}`;
}
