/**
 * Daily search runner — orchestrates the §3.4 pipeline:
 *
 *   1. Compute today's send budget (warmup cap − scheduled touches)
 *   2. Query all discovery sources in parallel
 *   3. Deduplicate against existing candidates + deals + DNC
 *   4. Enrich each survivor
 *   5. Build viability profile
 *   6. Score + qualify + assign track
 *   7. Take top `target` by score
 *   8–10. (LG-5+) Contact discovery + draft generation + drift check
 *   11. Insert into lead_candidates
 *   12. Write lead_runs summary row
 *
 * This session (LG-4) implements the full skeleton. Steps 8–10 (Hunter.io
 * contact discovery, draft generation, drift check) are stubbed as
 * pass-through — LG-5 wires them.
 *
 * Owner: LG-4. Consumer: scheduled-task handler, "Run now" button, manual brief.
 */

import { randomUUID } from "node:crypto";
import { eq, and, gte } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { companies } from "@/lib/db/schema/companies";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";
import { runDiscovery } from "./discovery";
import { enrichCandidate } from "./enrich";
import { assignTrack } from "./scoring";
import { isBlockedFromOutreach } from "./dnc";
import { createCandidate } from "./candidate";
import { discoverContact, type KnownContactName } from "./contact-discovery";
import { generateDraft } from "./draft-generator";
import { enforceWarmupCap, initWarmupState } from "./warmup";
import type { DiscoveredCandidate, DiscoverySearchParams } from "./types";
import type { LeadRunTrigger } from "@/lib/db/schema/lead-runs";

export interface DailySearchInput {
  trigger: LeadRunTrigger;
  manualBriefText?: string;
}

export interface DailySearchResult {
  runId: string;
  foundCount: number;
  dncFilteredCount: number;
  qualifiedCount: number;
  cappedReason: string | null;
  candidatesCreated: number;
  error: string | null;
  perSourceErrors: Record<string, string> | null;
}

/**
 * Execute the daily search pipeline. §12.A: `enforceWarmupCap` (step 1)
 * and `isBlockedFromOutreach` (step 3) are the only two gate functions.
 */
export async function runDailySearch(
  input: DailySearchInput,
  dbInstance = defaultDb,
): Promise<DailySearchResult> {
  const runId = randomUUID();
  const runStartedAt = new Date();

  // Kill-switch gate
  if (!killSwitches.lead_gen_enabled) {
    const run = await writeRunSummary(dbInstance, {
      id: runId,
      runStartedAt,
      trigger: input.trigger,
      manualBriefText: input.manualBriefText,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      draftedCount: 0,
      warmupCap: 0,
      effectiveCap: 0,
      cappedReason: "kill_switch_disabled",
      error: null,
      perSourceErrors: null,
    });
    return {
      runId: run.id,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      cappedReason: "kill_switch_disabled",
      candidatesCreated: 0,
      error: null,
      perSourceErrors: null,
    };
  }

  try {
    // ── Step 1: Compute today's send budget (§3.4, §12.A) ────────────
    // effective_cap = warmup_daily_cap − scheduled_sequence_touches_today
    // Then clamp to settings.max_per_day (user-configured upper bound).
    const maxPerDay = await settings.get("lead_generation.daily_max_per_day");
    await initWarmupState(dbInstance);
    const warmupState = await enforceWarmupCap(dbInstance);
    const warmupCap = warmupState.cap;
    const effectiveCap = Math.min(maxPerDay, warmupState.remaining);

    if (effectiveCap <= 0) {
      const run = await writeRunSummary(dbInstance, {
        id: runId,
        runStartedAt,
        trigger: input.trigger,
        manualBriefText: input.manualBriefText,
        foundCount: 0,
        dncFilteredCount: 0,
        qualifiedCount: 0,
        draftedCount: 0,
        warmupCap,
        effectiveCap,
        cappedReason: "effective_cap_zero",
        error: null,
        perSourceErrors: null,
      });
      return {
        runId: run.id,
        foundCount: 0,
        dncFilteredCount: 0,
        qualifiedCount: 0,
        cappedReason: "effective_cap_zero",
        candidatesCreated: 0,
        error: null,
        perSourceErrors: null,
      };
    }

    // ── Step 2: Query all sources in parallel ────────────────────────
    const searchParams = await buildSearchParams(input.manualBriefText);
    const discoveryResult = await runDiscovery(searchParams);
    const foundCount = discoveryResult.total_found_before_dedup;

    // ── Step 3: Deduplicate ──────────────────────────────────────────
    const dedupWindowDays = await settings.get(
      "lead_generation.dedup_window_days",
    );
    const dedupCutoff = new Date(
      Date.now() - dedupWindowDays * 24 * 60 * 60 * 1000,
    );

    const { survivors, dncFilteredCount } = await deduplicateCandidates(
      discoveryResult.candidates,
      dedupCutoff,
      dbInstance,
    );

    // ── Steps 4–6: Enrich + score + qualify ──────────────────────────
    const trackPriority = await settings.get("lead_generation.track_priority");

    const scoredCandidates: Array<{
      discovered: DiscoveredCandidate;
      assignment: ReturnType<typeof assignTrack>;
      enrichedProfile: Awaited<ReturnType<typeof enrichCandidate>>["profile"];
      scrapedContacts: Awaited<ReturnType<typeof enrichCandidate>>["scraped_contacts"];
      scrapedPhones: Awaited<ReturnType<typeof enrichCandidate>>["scraped_phones"];
    }> = [];

    for (const candidate of survivors) {
      const enrichResult = await enrichCandidate(candidate);
      const assignment = assignTrack(enrichResult.profile);

      if (assignment.track === null) continue;
      if (trackPriority === "saas" && assignment.track !== "saas") continue;
      if (trackPriority === "retainer" && assignment.track !== "retainer") continue;

      scoredCandidates.push({
        discovered: candidate,
        assignment,
        enrichedProfile: enrichResult.profile,
        scrapedContacts: enrichResult.scraped_contacts,
        scrapedPhones: enrichResult.scraped_phones,
      });
    }

    // ── Step 7: Take top `target` by score ───────────────────────────
    scoredCandidates.sort((a, b) => b.assignment.score - a.assignment.score);
    const topCandidates = scoredCandidates.slice(0, effectiveCap);

    // ── Steps 8–11: Contact discovery + draft generation + insert ────
    const standingBrief =
      input.manualBriefText ??
      (await settings.get("lead_generation.standing_brief"));

    let candidatesCreated = 0;
    let draftedCount = 0;
    for (const entry of topCandidates) {
      // Step 8: Discover contact email — Hunter.io primary, website scrape fallback
      const domain = entry.discovered.domain;
      let contactResult = {
        email: null as string | null,
        name: null as string | null,
        role: null as string | null,
        phone: null as string | null,
        confidence: "unknown" as "verified" | "inferred" | "unknown",
      };

      // Build known names from website scrape for Hunter pattern cross-pollination
      const knownNames: KnownContactName[] = entry.scrapedContacts
        .filter((c) => c.name)
        .map((c) => {
          const parts = c.name!.split(/\s+/);
          return {
            first: parts[0],
            last: parts.slice(1).join(" "),
            role: c.role,
          };
        })
        .filter((n) => n.first && n.last);

      if (domain) {
        const hunterResult = await discoverContact(
          domain,
          entry.discovered.company_name,
          knownNames,
        );
        contactResult = {
          email: hunterResult.email,
          name: hunterResult.name,
          role: hunterResult.role,
          phone: null,
          confidence: hunterResult.confidence,
        };
      }

      // Fallback: use contacts scraped from the website during enrichment
      if (!contactResult.email && entry.scrapedContacts.length > 0) {
        const best = entry.scrapedContacts[0];
        contactResult = {
          email: best.email,
          name: best.name,
          role: best.role,
          phone: best.phone,
          confidence: "inferred",
        };
      }

      // Attach phone from scraped contacts or standalone phone list
      if (!contactResult.phone) {
        const phoneFromContact = entry.scrapedContacts.find((c) => c.phone)?.phone;
        const phoneFromPhones = entry.scrapedPhones?.[0]?.number;
        contactResult.phone = phoneFromContact ?? phoneFromPhones ?? null;
      }

      // Step 11: Insert candidate with contact info (even without email —
      // candidates without emails are created but won't get drafts)
      const candidateResult = await createCandidate(
        {
          discovered: entry.discovered,
          enrichedProfile: entry.enrichedProfile,
          trackAssignment: entry.assignment,
          leadRunId: runId,
          contactEmail: contactResult.email ?? undefined,
          contactName: contactResult.name ?? undefined,
          contactRole: contactResult.role ?? undefined,
          contactPhone: contactResult.phone,
          emailConfidence: contactResult.confidence,
        },
        dbInstance,
      );
      candidatesCreated++;

      // Steps 9–10: Generate draft + drift check (§8, §8.4)
      // Only generate drafts for candidates with a contact email
      if (contactResult.email) {
        const draftOutcome = await generateDraft(
          {
            track: entry.assignment.track!,
            touchKind: "first_touch",
            touchIndex: 1,
            viabilityProfile: entry.enrichedProfile,
            standingBrief,
            manualBriefOverride: input.manualBriefText,
            priorTouches: [],
            recentBlogPosts: [],
            contactInfo: {
              name: contactResult.name ?? undefined,
              email: contactResult.email,
              role: contactResult.role ?? undefined,
              company: entry.discovered.company_name,
            },
            candidateId: candidateResult.candidateId,
          },
          dbInstance,
        );

        if (draftOutcome.ok) {
          draftedCount++;
        }
      }
    }

    // ── Step 12: Write lead_runs summary ─────────────────────────────
    const perSourceErrors: Record<string, string> = {};
    for (const sr of discoveryResult.source_results) {
      if (sr.error) perSourceErrors[sr.source] = sr.error;
    }

    await writeRunSummary(dbInstance, {
      id: runId,
      runStartedAt,
      trigger: input.trigger,
      manualBriefText: input.manualBriefText,
      foundCount,
      dncFilteredCount,
      qualifiedCount: scoredCandidates.length,
      draftedCount,
      warmupCap,
      effectiveCap,
      cappedReason:
        scoredCandidates.length > effectiveCap ? "warmup_cap" : null,
      error: null,
      perSourceErrors:
        Object.keys(perSourceErrors).length > 0 ? perSourceErrors : null,
    });

    return {
      runId,
      foundCount,
      dncFilteredCount,
      qualifiedCount: scoredCandidates.length,
      cappedReason:
        scoredCandidates.length > effectiveCap ? "warmup_cap" : null,
      candidatesCreated,
      error: null,
      perSourceErrors:
        Object.keys(perSourceErrors).length > 0 ? perSourceErrors : null,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await writeRunSummary(dbInstance, {
      id: runId,
      runStartedAt,
      trigger: input.trigger,
      manualBriefText: input.manualBriefText,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      draftedCount: 0,
      warmupCap: 0,
      effectiveCap: 0,
      cappedReason: null,
      error: errorMsg,
      perSourceErrors: null,
    });

    return {
      runId,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      cappedReason: null,
      candidatesCreated: 0,
      error: errorMsg,
      perSourceErrors: null,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function buildSearchParams(
  manualBriefOverride?: string,
): Promise<DiscoverySearchParams> {
  const [location, radiusKm, category, standingBrief, maxPerDay] =
    await Promise.all([
      settings.get("lead_generation.location_centre"),
      settings.get("lead_generation.location_radius_km"),
      settings.get("lead_generation.category"),
      settings.get("lead_generation.standing_brief"),
      settings.get("lead_generation.daily_max_per_day"),
    ]);

  return {
    location,
    radius_km: radiusKm,
    category,
    brief: manualBriefOverride ?? standingBrief,
    max_candidates: maxPerDay * 3, // fetch wider, score tighter
  };
}

/**
 * Dedup candidates against existing lead_candidates (within window),
 * companies (existing deals), and DNC list.
 */
async function deduplicateCandidates(
  candidates: DiscoveredCandidate[],
  dedupCutoff: Date,
  dbInstance: typeof defaultDb,
): Promise<{
  survivors: DiscoveredCandidate[];
  dncFilteredCount: number;
}> {
  const survivors: DiscoveredCandidate[] = [];
  let dncFilteredCount = 0;

  for (const candidate of candidates) {
    // Skip candidates without domain or email for DNC check
    if (!candidate.domain) {
      survivors.push(candidate);
      continue;
    }

    const domain = candidate.domain.toLowerCase();

    // Check existing lead_candidates within dedup window
    const existingCandidate = await dbInstance
      .select({ id: leadCandidates.id })
      .from(leadCandidates)
      .where(
        and(
          eq(leadCandidates.domain, domain),
          gte(leadCandidates.created_at, dedupCutoff),
        ),
      )
      .get();

    if (existingCandidate) continue;

    // Check existing companies (existing deals)
    const existingCompany = await dbInstance
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.domain, domain))
      .get();

    if (existingCompany) continue;

    // DNC check — the contact email isn't known yet at dedup time,
    // so we use a placeholder to trigger domain-level DNC only.
    const dncCheck = await isBlockedFromOutreach(`unknown@${domain}`);
    if (dncCheck.blocked) {
      dncFilteredCount++;
      continue;
    }

    survivors.push(candidate);
  }

  return { survivors, dncFilteredCount };
}

interface RunSummaryInput {
  id: string;
  runStartedAt: Date;
  trigger: LeadRunTrigger;
  manualBriefText?: string;
  foundCount: number;
  dncFilteredCount: number;
  qualifiedCount: number;
  draftedCount: number;
  warmupCap: number;
  effectiveCap: number;
  cappedReason: string | null;
  error: string | null;
  perSourceErrors: Record<string, string> | null;
}

async function writeRunSummary(
  dbInstance: typeof defaultDb,
  input: RunSummaryInput,
) {
  const [inserted] = await dbInstance
    .insert(leadRuns)
    .values({
      id: input.id,
      run_started_at: input.runStartedAt,
      run_completed_at: new Date(),
      trigger: input.trigger,
      manual_brief_text: input.manualBriefText ?? null,
      found_count: input.foundCount,
      dnc_filtered_count: input.dncFilteredCount,
      qualified_count: input.qualifiedCount,
      drafted_count: input.draftedCount,
      warmup_cap_at_run: input.warmupCap,
      effective_cap_at_run: input.effectiveCap,
      capped_reason: input.cappedReason,
      error: input.error,
      per_source_errors_json: input.perSourceErrors,
    })
    .returning();
  return inserted;
}

/**
 * Compute the next 3am Melbourne time for self-perpetuating scheduling.
 * DST-safe via Intl.DateTimeFormat.
 */
export function next3amMelbourneMs(): number {
  const now = new Date();
  const melbFmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = melbFmt.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const melbHour = parseInt(get("hour"), 10);
  const melbYear = parseInt(get("year"), 10);
  const melbMonth = parseInt(get("month"), 10) - 1;
  const melbDay = parseInt(get("day"), 10);

  // If it's already past 3am Melbourne, schedule for tomorrow
  const targetDay = melbHour >= 3 ? melbDay + 1 : melbDay;

  // Build a Date in Melbourne's "wall clock" 03:00
  // We construct it via UTC and offset manually
  const target = new Date(
    Date.UTC(melbYear, melbMonth, targetDay, 3, 0, 0, 0),
  );

  // Adjust for Melbourne offset: compute what UTC time 03:00 Melbourne is
  const melbOffsetStr = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    timeZoneName: "shortOffset",
  })
    .formatToParts(target)
    .find((p) => p.type === "timeZoneName")?.value;

  // Parse offset like "GMT+11" or "GMT+10"
  const offsetMatch = melbOffsetStr?.match(/GMT([+-]\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : 11;

  // 03:00 Melbourne = 03:00 - offset in UTC
  const utcMs = target.getTime() - offsetHours * 60 * 60 * 1000;

  // If the computed time is in the past (edge case around midnight), add a day
  if (utcMs <= Date.now()) {
    return utcMs + 24 * 60 * 60 * 1000;
  }

  return utcMs;
}
