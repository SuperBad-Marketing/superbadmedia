import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { companies } from "@/lib/db/schema/companies";
import { activity_log } from "@/lib/db/schema/activity-log";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { killSwitches } from "@/lib/kill-switches";
import { modelFor } from "@/lib/ai/models";
import { checkBrandVoiceDrift, type DriftCheckResult } from "@/lib/ai/drift-check";
import { getSuperbadBrandProfile } from "./superbad-brand-profile";
import {
  buildDraftIntroParagraphPrompt,
  type DraftIntroParagraphOutput,
  type IntroParagraphSource,
} from "@/lib/ai/prompts/quote-builder/draft-intro-paragraph";
import { settingsRegistry } from "@/lib/settings";

type DatabaseLike = typeof defaultDb;

export interface ComposedIntroParagraph {
  /** Final paragraph text (≤120 words). Empty when no sources available. */
  paragraph_text: string;
  /** Human-readable provenance hint (e.g. "rank-2 notes + rank-3 activity"). */
  provenance: string;
  confidence: "high" | "medium" | "low";
  primary_source_rank: 1 | 2 | 3 | 4 | null;
  drew_from_ranks: (1 | 2 | 3 | 4)[];
  /** Drift check against SuperBad's brand profile. */
  drift: DriftCheckResult;
  /** True when LLM bypassed (kill switch) or no sources — paragraph_text may be empty. */
  fallbackUsed: boolean;
  flags: Record<string, string>;
}

export interface ComposeIntroParagraphInput {
  quote_id: string;
  freeformInstruction?: string | null;
}

const CLIENT_SINGLETON = new Anthropic();
const MAX_OUTPUT_TOKENS = 700;

/** rank-3 activity-log kinds that carry client voice or factual context. */
const RANK_3_ACTIVITY_KINDS = [
  "feedback_received",
  "email_received",
  "trial_shoot_completed",
] as const;

function rankLabel(rank: 1 | 2 | 3 | 4): string {
  return rank === 1
    ? "client docs"
    : rank === 2
      ? "notes"
      : rank === 3
        ? "activity"
        : "brand profile";
}

async function gatherSources(
  quoteDealId: string,
  quoteCompanyId: string,
  database: DatabaseLike,
): Promise<IntroParagraphSource[]> {
  const sources: IntroParagraphSource[] = [];

  // Rank 2 — deal-level operator notes (activity_log kind='note' on this deal).
  const notes = await database
    .select({ body: activity_log.body, created_at_ms: activity_log.created_at_ms })
    .from(activity_log)
    .where(and(eq(activity_log.deal_id, quoteDealId), eq(activity_log.kind, "note")))
    .orderBy(desc(activity_log.created_at_ms))
    .limit(10);
  if (notes.length > 0) {
    sources.push({
      rank: 2,
      label: `deal notes (${notes.length})`,
      text: notes.map((n) => `- ${n.body}`).join("\n"),
    });
  }

  // Rank 3 — meaningful company-scoped activity (feedback, received emails, trial-shoot completed).
  const activity = await database
    .select({ kind: activity_log.kind, body: activity_log.body, created_at_ms: activity_log.created_at_ms })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.company_id, quoteCompanyId),
        inArray(activity_log.kind, [...RANK_3_ACTIVITY_KINDS]),
      ),
    )
    .orderBy(desc(activity_log.created_at_ms))
    .limit(15);
  if (activity.length > 0) {
    sources.push({
      rank: 3,
      label: `activity log (${activity.length})`,
      text: activity.map((a) => `[${a.kind}] ${a.body}`).join("\n"),
    });
  }

  // Rank 4 — Brand DNA profile for the company, if completed.
  const profile = await database
    .select({ prose: brand_dna_profiles.prose_portrait })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.company_id, quoteCompanyId),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .orderBy(desc(brand_dna_profiles.completed_at_ms))
    .limit(1);
  const prose = profile[0]?.prose;
  if (prose && prose.trim().length > 0) {
    sources.push({ rank: 4, label: "Brand DNA", text: prose });
  }

  return sources;
}

function buildProvenance(ranks: (1 | 2 | 3 | 4)[]): string {
  if (ranks.length === 0) return "no sources";
  const dedup = Array.from(new Set(ranks)).sort();
  return dedup.map((r) => `rank-${r} ${rankLabel(r)}`).join(" + ");
}

function parseLlmOutput(raw: string): DraftIntroParagraphOutput | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(stripped) as Partial<DraftIntroParagraphOutput>;
    if (typeof parsed.paragraph_text !== "string") return null;
    const rank = parsed.primary_source_rank;
    if (rank !== 1 && rank !== 2 && rank !== 3 && rank !== 4) return null;
    const drew = Array.isArray(parsed.drew_from_ranks)
      ? (parsed.drew_from_ranks.filter(
          (r) => r === 1 || r === 2 || r === 3 || r === 4,
        ) as (1 | 2 | 3 | 4)[])
      : [];
    const conf = parsed.confidence;
    if (conf !== "high" && conf !== "medium" && conf !== "low") return null;
    return {
      paragraph_text: parsed.paragraph_text.trim(),
      primary_source_rank: rank,
      drew_from_ranks: drew,
      confidence: conf,
      flags_json:
        parsed.flags_json && typeof parsed.flags_json === "object"
          ? (parsed.flags_json as Record<string, string>)
          : {},
    };
  } catch {
    return null;
  }
}

/**
 * Compose the §1 "What you told us" paragraph for a quote via pyramid
 * source-rank synthesis (spec §6.2 / Q17). Reads client-scoped material,
 * drives Opus with an explicit rank hierarchy, drift-checks the output
 * against SuperBad's brand profile.
 *
 * Empty-source case: returns `paragraph_text=""` + `confidence=low` +
 * `fallbackUsed=true` without calling the LLM (spec §3.1.4 — "Claude
 * does not attempt to generate from vacuum").
 *
 * Kill-switch case (`llm_calls_enabled=false`): same empty-paragraph
 * shape so the editor renders the placeholder rather than a stale draft.
 *
 * Throttling is the caller's responsibility — see
 * `redraftIntroParagraphAction`.
 */
export async function composeIntroParagraph(
  input: ComposeIntroParagraphInput,
  dbOverride?: DatabaseLike,
): Promise<ComposedIntroParagraph> {
  const database = dbOverride ?? defaultDb;
  const quote = await database
    .select({
      id: quotes.id,
      deal_id: quotes.deal_id,
      company_id: quotes.company_id,
    })
    .from(quotes)
    .where(eq(quotes.id, input.quote_id))
    .get();
  if (!quote) throw new Error(`intro: quote ${input.quote_id} not found`);

  const company = await database
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, quote.company_id))
    .get();
  if (!company) throw new Error(`intro: company ${quote.company_id} not found`);

  const sources = await gatherSources(quote.deal_id, quote.company_id, database);
  const availableRanks = sources.map((s) => s.rank);

  if (sources.length === 0 || !killSwitches.llm_calls_enabled) {
    return {
      paragraph_text: "",
      provenance: buildProvenance(availableRanks),
      confidence: "low",
      primary_source_rank: null,
      drew_from_ranks: [],
      drift: { pass: true, score: 1.0, notes: "skipped (no sources or kill switch off)" },
      fallbackUsed: true,
      flags: sources.length === 0 ? { empty: "true" } : { kill_switch: "true" },
    };
  }

  const modelId = modelFor("quote-builder-draft-intro-paragraph");
  const promptText = buildDraftIntroParagraphPrompt({
    companyName: company.name,
    sources,
    freeformInstruction: input.freeformInstruction ?? null,
  });

  const response = await CLIENT_SINGLETON.messages.create({
    model: modelId,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [{ role: "user", content: promptText }],
  });
  const raw = response.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = parseLlmOutput(raw);

  if (!parsed || !parsed.paragraph_text) {
    return {
      paragraph_text: "",
      provenance: buildProvenance(availableRanks),
      confidence: "low",
      primary_source_rank: null,
      drew_from_ranks: [],
      drift: { pass: true, score: 1.0, notes: "llm parse-failure; left blank for hand-write" },
      fallbackUsed: true,
      flags: { parse_failure: "true" },
    };
  }

  const profile = await getSuperbadBrandProfile(database);
  const drift = await checkBrandVoiceDrift(parsed.paragraph_text, profile);

  return {
    paragraph_text: parsed.paragraph_text,
    provenance: buildProvenance(parsed.drew_from_ranks.length ? parsed.drew_from_ranks : [parsed.primary_source_rank]),
    confidence: parsed.confidence,
    primary_source_rank: parsed.primary_source_rank,
    drew_from_ranks: parsed.drew_from_ranks,
    drift,
    fallbackUsed: false,
    flags: parsed.flags_json,
  };
}

/**
 * Check the per-quote redraft throttle. Returns `{allowed, resetMs}`.
 * Counts `activity_log` note-rows tagged with `meta.kind='quote_intro_redrafted'`
 * for the given quote in the last hour against the configured hourly cap.
 */
export async function checkIntroRedraftThrottle(
  quoteId: string,
  nowMs: number = Date.now(),
  dbOverride?: DatabaseLike,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const database = dbOverride ?? defaultDb;
  const cap = await settingsRegistry.get("quote.intro_paragraph_redraft_hourly_cap");
  const windowMs = 60 * 60 * 1000;
  const since = nowMs - windowMs;
  const rows = await database
    .select({ created_at_ms: activity_log.created_at_ms, meta: activity_log.meta })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.kind, "note"),
        gte(activity_log.created_at_ms, since),
      ),
    );
  const used = rows.filter((r) => {
    const m = r.meta as Record<string, unknown> | null;
    return m && m.kind === "quote_intro_redrafted" && m.quote_id === quoteId;
  });
  const remaining = Math.max(0, cap - used.length);
  const oldest = used.length > 0 ? Math.min(...used.map((r) => r.created_at_ms)) : nowMs;
  const resetMs = oldest + windowMs;
  return { allowed: remaining > 0, remaining, resetMs };
}
