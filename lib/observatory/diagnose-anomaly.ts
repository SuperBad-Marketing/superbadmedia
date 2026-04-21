/**
 * Anomaly diagnoser — spec §3.3 + §7 prompt 1.
 *
 * Fires as a scheduled task (`cost_anomaly_diagnose`) the moment a new
 * anomaly is created. Calls Opus with the anomaly context, caches the
 * structured diagnosis JSON on the `cost_anomaly` row.
 *
 * Per-hour cap prevents recursive diagnosis loops (spec §14, scenario 10).
 * If the diagnoser's own calls trigger an anomaly, that anomaly is
 * dedupe-collapsed and the cap absorbs the burst.
 *
 * Owner: COB-8 (Wave 21).
 */
import { and, eq, gte, desc, sql, isNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import { deploy_events } from "@/lib/db/schema/deploy-events";
import { getJobEntry } from "./job-registry";
import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmTextWithMeta } from "@/lib/ai/invoke";
import { estimateAnthropicCostAud } from "./pricing";
import { modelTierFor } from "@/lib/ai/models";
import { logActivity } from "@/lib/activity-log";

const DIAGNOSER_JOB = "observatory-diagnose-cost-anomaly" as const;
const MAX_DIAGNOSES_PER_HOUR = 10;
const RECENT_CALLS_LIMIT = 100;
const MS_1H = 60 * 60 * 1000;
const MS_24H = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiagnosisResult {
  hypothesis: string;
  confidence: "high" | "med" | "low";
  recommended_action: string;
  timeline_markdown: string;
}

export interface DiagnoseAnomalyResult {
  skipped: boolean;
  reason?: string;
  diagnosis?: DiagnosisResult;
  costAud?: number;
}

// ---------------------------------------------------------------------------
// Per-hour cap check
// ---------------------------------------------------------------------------

async function countRecentDiagnoses(d: typeof defaultDb): Promise<number> {
  const windowStart = Date.now() - MS_1H;
  const rows = await d
    .select({ count: sql<number>`count(*)` })
    .from(cost_anomalies)
    .where(
      and(
        gte(cost_anomalies.first_fired_at_ms, windowStart),
        sql`${cost_anomalies.diagnosis_json} IS NOT NULL`,
      ),
    );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Context assembly
// ---------------------------------------------------------------------------

interface DiagnosisContext {
  anomaly: typeof cost_anomalies.$inferSelect;
  recentCalls: {
    id: string;
    job: string;
    estimated_cost_aud: number;
    prompt_version_hash: string | null;
    created_at_ms: number;
    actor_type: string;
    actor_id: string | null;
  }[];
  registrySnapshot: {
    vendor: string;
    description: string;
    per_call_ceiling_aud: number;
    daily_ceiling_aud: number;
    learned_band_multiplier: number;
  } | null;
  deployEvents: {
    commit_sha: string;
    deployed_at_ms: number;
    status: string;
  }[];
  promptVersionHistory: {
    prompt_version_hash: string;
    first_seen_ms: number;
    last_seen_ms: number;
    call_count: number;
  }[];
}

async function assembleContext(
  anomalyId: string,
  d: typeof defaultDb,
): Promise<DiagnosisContext | null> {
  const anomalyRows = await d
    .select()
    .from(cost_anomalies)
    .where(eq(cost_anomalies.id, anomalyId))
    .limit(1);

  if (anomalyRows.length === 0) return null;
  const anomaly = anomalyRows[0];

  const recentCalls = await d
    .select({
      id: external_call_log.id,
      job: external_call_log.job,
      estimated_cost_aud: external_call_log.estimated_cost_aud,
      prompt_version_hash: external_call_log.prompt_version_hash,
      created_at_ms: external_call_log.created_at_ms,
      actor_type: external_call_log.actor_type,
      actor_id: external_call_log.actor_id,
    })
    .from(external_call_log)
    .where(eq(external_call_log.job, anomaly.job))
    .orderBy(desc(external_call_log.created_at_ms))
    .limit(RECENT_CALLS_LIMIT);

  const entry = getJobEntry(anomaly.job);
  const registrySnapshot = entry
    ? {
        vendor: entry.vendor,
        description: entry.description,
        per_call_ceiling_aud: entry.bands.per_call_ceiling_aud,
        daily_ceiling_aud: entry.bands.daily_ceiling_aud,
        learned_band_multiplier: entry.bands.learned_band_multiplier,
      }
    : null;

  const deployWindow = Date.now() - MS_24H;
  const deployRows = await d
    .select({
      commit_sha: deploy_events.commit_sha,
      deployed_at_ms: deploy_events.deployed_at_ms,
      status: deploy_events.status,
    })
    .from(deploy_events)
    .where(gte(deploy_events.deployed_at_ms, deployWindow))
    .orderBy(desc(deploy_events.deployed_at_ms));

  const promptVersionHistory = await d
    .select({
      prompt_version_hash: external_call_log.prompt_version_hash,
      first_seen_ms: sql<number>`min(${external_call_log.created_at_ms})`,
      last_seen_ms: sql<number>`max(${external_call_log.created_at_ms})`,
      call_count: sql<number>`count(*)`,
    })
    .from(external_call_log)
    .where(
      and(
        eq(external_call_log.job, anomaly.job),
        sql`${external_call_log.prompt_version_hash} IS NOT NULL`,
      ),
    )
    .groupBy(external_call_log.prompt_version_hash)
    .orderBy(sql`min(${external_call_log.created_at_ms}) DESC`)
    .limit(10);

  return {
    anomaly,
    recentCalls,
    registrySnapshot,
    deployEvents: deployRows,
    promptVersionHistory: promptVersionHistory.map((r) => ({
      prompt_version_hash: r.prompt_version_hash!,
      first_seen_ms: r.first_seen_ms,
      last_seen_ms: r.last_seen_ms,
      call_count: r.call_count,
    })),
  };
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

function buildPrompt(ctx: DiagnosisContext): string {
  const a = ctx.anomaly;
  const expectedBand =
    typeof a.expected_band === "object" ? JSON.stringify(a.expected_band) : String(a.expected_band);

  let prompt = `You are a cost-anomaly diagnoser for the SuperBad Lite platform. Analyse the anomaly below and produce a structured diagnosis.

## Anomaly
- ID: ${a.id}
- Detector: ${a.detector}
- Job: ${a.job}
- Tier: ${a.tier}
- Observed value: $${a.observed_value.toFixed(4)} AUD
- Expected band: ${expectedBand}
- First fired: ${new Date(a.first_fired_at_ms).toISOString()}
- Last fired: ${new Date(a.last_fired_at_ms).toISOString()}
- Fire count: ${a.fire_count}
${a.actor_scope ? `- Actor scope: ${JSON.stringify(a.actor_scope)}` : ""}

## Job Registry Entry
${ctx.registrySnapshot ? JSON.stringify(ctx.registrySnapshot, null, 2) : "Not found in registry — unknown job."}

## Recent Calls (last ${ctx.recentCalls.length}, newest first)
${
  ctx.recentCalls.length === 0
    ? "No calls found."
    : ctx.recentCalls
        .map(
          (c) =>
            `- ${new Date(c.created_at_ms).toISOString()} | $${c.estimated_cost_aud.toFixed(4)} | actor: ${c.actor_type}${c.actor_id ? `/${c.actor_id}` : ""} | prompt_hash: ${c.prompt_version_hash ?? "none"}`,
        )
        .join("\n")
}

## Deploy Events (last 24h)
${
  ctx.deployEvents.length === 0
    ? "No deploys in the last 24 hours."
    : ctx.deployEvents
        .map(
          (d) =>
            `- ${new Date(d.deployed_at_ms).toISOString()} | ${d.commit_sha} | ${d.status}`,
        )
        .join("\n")
}

## Prompt Version History (for this job)
${
  ctx.promptVersionHistory.length === 0
    ? "No prompt version hashes recorded."
    : ctx.promptVersionHistory
        .map(
          (p) =>
            `- hash: ${p.prompt_version_hash} | first seen: ${new Date(p.first_seen_ms).toISOString()} | last seen: ${new Date(p.last_seen_ms).toISOString()} | calls: ${p.call_count}`,
        )
        .join("\n")
}

## Instructions
1. Analyse the data above. Identify the most likely cause of the anomaly.
2. Write a one-paragraph hypothesis in plain English. Be direct and specific. Use a dry, calm tone — no alarm, no hedging words like "it seems" or "perhaps". State what happened and why.
3. Assign a confidence level: "high" (strong evidence), "med" (correlating signals but gaps), or "low" (speculation).
4. Recommend exactly one action: "acknowledge" (benign, no intervention needed), "investigate" (ambiguous, needs human review), or "kill_switch" (likely regression or loop, stop the job).
5. Produce a timeline of contributing factors in the trailing 24 hours as Markdown bullet points.

Respond with ONLY a JSON object matching this exact shape — no markdown fences, no commentary:
{"hypothesis":"...","confidence":"high|med|low","recommended_action":"acknowledge|investigate|kill_switch","timeline_markdown":"- ...\\n- ..."}`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Parse response
// ---------------------------------------------------------------------------

function parseDiagnosis(raw: string): DiagnosisResult | null {
  try {
    const cleaned = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.hypothesis !== "string" ||
      !["high", "med", "low"].includes(parsed.confidence) ||
      !["acknowledge", "investigate", "kill_switch"].includes(parsed.recommended_action) ||
      typeof parsed.timeline_markdown !== "string"
    ) {
      return null;
    }
    return {
      hypothesis: parsed.hypothesis,
      confidence: parsed.confidence,
      recommended_action: parsed.recommended_action,
      timeline_markdown: parsed.timeline_markdown,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function diagnoseAnomaly(
  anomalyId: string,
  dbArg?: typeof defaultDb,
): Promise<DiagnoseAnomalyResult> {
  if (!killSwitches.observatory_detectors_enabled) {
    return { skipped: true, reason: "observatory_detectors_enabled is off" };
  }

  const d = dbArg ?? defaultDb;

  const recentCount = await countRecentDiagnoses(d);
  if (recentCount >= MAX_DIAGNOSES_PER_HOUR) {
    return { skipped: true, reason: `per-hour cap reached (${recentCount}/${MAX_DIAGNOSES_PER_HOUR})` };
  }

  const ctx = await assembleContext(anomalyId, d);
  if (!ctx) {
    return { skipped: true, reason: `anomaly ${anomalyId} not found` };
  }

  if (ctx.anomaly.diagnosis_json !== null) {
    return { skipped: true, reason: "already diagnosed" };
  }

  const prompt = buildPrompt(ctx);

  const result = await invokeLlmTextWithMeta({
    job: DIAGNOSER_JOB,
    prompt,
    maxTokens: 2048,
    actorType: "internal",
  });

  const tier = modelTierFor(DIAGNOSER_JOB);
  const costAud = estimateAnthropicCostAud(tier, {
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  const diagnosis = parseDiagnosis(result.text);

  if (!diagnosis) {
    await logActivity({
      kind: "cost_anomaly_fired",
      body: `Diagnosis parse failure for anomaly "${anomalyId}". Raw response length: ${result.text.length}.`,
      meta: {
        anomaly_id: anomalyId,
        raw_length: result.text.length,
        cost_aud: costAud,
      },
    });
    return { skipped: true, reason: "diagnosis parse failure" };
  }

  await d
    .update(cost_anomalies)
    .set({
      diagnosis_json: diagnosis,
      diagnosis_cost_aud: costAud,
    })
    .where(eq(cost_anomalies.id, anomalyId));

  await logActivity({
    kind: "cost_anomaly_fired",
    body: `Diagnosis complete for "${ctx.anomaly.job}" anomaly: ${diagnosis.confidence} confidence, action: ${diagnosis.recommended_action}.`,
    meta: {
      anomaly_id: anomalyId,
      job: ctx.anomaly.job,
      confidence: diagnosis.confidence,
      recommended_action: diagnosis.recommended_action,
      cost_aud: costAud,
    },
  });

  return { skipped: false, diagnosis, costAud };
}
