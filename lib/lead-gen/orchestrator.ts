/**
 * Lead Generation daily run orchestrator — steps 1–10 + step 12.
 *
 * Steps 8–10 (candidate insertion, Hunter.io contact discovery, Claude draft)
 * added in LG-9. Steps 11–12 (drift check, approval queue) are LG-10+.
 *
 * Owner: LG-4. Extended: LG-9. Consumers: cron handler, admin "Run now" action.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leadRuns } from "@/lib/db/schema/lead-runs";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { killSwitches } from "@/lib/kill-switches";
import settings from "@/lib/settings";
import { getCredential } from "@/lib/integrations/getCredential";
import { searchMetaAdLibrary, searchGoogleMaps, searchGoogleAdsTransparency } from "./sources";
import {
  enrichPageSpeed,
  enrichDomainAge,
  enrichInstagram,
  enrichYouTube,
  enrichWebsiteScrape,
  enrichMapsPhotos,
  mergeProfiles,
} from "./enrichment";
import { enforceWarmupCap } from "./warmup";
import { deduplicateCandidates } from "./dedup";
import type { DiscoveryCandidate, DiscoveryResult, DiscoverySearchInput, ViabilityProfile } from "./types";
import { scoreForSaasTrack, scoreForRetainerTrack } from "./scoring";
import { discoverContactEmail } from "./email-discovery";
import { generateDraft } from "./draft-generator";

// ── Run summary ───────────────────────────────────────────────────────────────

export interface LeadRunSummary {
  id: string;
  trigger: "scheduled" | "run_now" | "manual_brief";
  found_count: number;
  dnc_filtered_count: number;
  qualified_count: number;
  warmup_cap_at_run: number;
  effective_cap_at_run: number;
  capped_reason: string | null;
  error: string | null;
  per_source_errors: Record<string, string>;
  started_at_ms: number;
  completed_at_ms: number;
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runLeadGenDaily(
  trigger: "scheduled" | "run_now" | "manual_brief",
): Promise<LeadRunSummary> {
  const startedAt = new Date();
  const runId = crypto.randomUUID();

  // Step 1: Kill-switch gate
  if (!killSwitches.lead_gen_enabled) {
    return persistRun({
      id: runId,
      trigger,
      startedAt,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      draftedCount: 0,
      warmupCap: 0,
      effectiveCap: 0,
      cappedReason: "kill_switch_disabled",
      error: null,
      perSourceErrors: {},
    });
  }

  // Step 1: Compute warmup cap
  const warmup = await enforceWarmupCap();
  const dailyMax = await settings.get("lead_generation.daily_max_per_day");
  const target = Math.min(dailyMax, warmup.remaining);

  if (target <= 0) {
    return persistRun({
      id: runId,
      trigger,
      startedAt,
      foundCount: 0,
      dncFilteredCount: 0,
      qualifiedCount: 0,
      draftedCount: 0,
      warmupCap: warmup.cap,
      effectiveCap: 0,
      cappedReason: "warmup_cap_exhausted",
      error: null,
      perSourceErrors: {},
    });
  }

  // Step 2: Build search input from settings
  const [locationCentre, locationRadiusKm, category] = await Promise.all([
    settings.get("lead_generation.location_centre"),
    settings.get("lead_generation.location_radius_km"),
    settings.get("lead_generation.category"),
  ]);

  const searchInput: DiscoverySearchInput = {
    locationCentre,
    locationRadiusKm,
    category,
    maxResults: Math.max(target * 3, 20), // over-fetch to allow for dedup losses
  };

  // Fetch credentials once for all sources and enrichers
  const [serpApiKey, metaAccessToken] = await Promise.all([
    getCredential("serpapi"),
    getCredential("meta"),
  ]);
  const youtubeApiKey = await getCredential("youtube");

  // Step 2: Query all 3 source adapters in parallel
  const sourceResults = await Promise.allSettled([
    searchMetaAdLibrary(searchInput, metaAccessToken ?? ""),
    searchGoogleMaps(searchInput, serpApiKey ?? ""),
    searchGoogleAdsTransparency(searchInput, serpApiKey ?? ""),
  ]);

  const perSourceErrors: Record<string, string> = {};
  const allCandidates: DiscoveryCandidate[] = [];

  const sourceNames: DiscoveryResult["source"][] = [
    "meta_ad_library",
    "google_maps",
    "google_ads_transparency",
  ];

  for (let i = 0; i < sourceResults.length; i++) {
    const result = sourceResults[i];
    const sourceName = sourceNames[i];

    if (result.status === "fulfilled") {
      if (result.value.fetchError) {
        perSourceErrors[sourceName] = result.value.fetchError;
      }
      allCandidates.push(...result.value.candidates);
    } else {
      perSourceErrors[sourceName] = String(result.reason);
    }
  }

  const foundCount = allCandidates.length;

  // Step 3: Deduplicate
  const dedupWindowDays = await settings.get("lead_generation.dedup_window_days");
  const survivors = await deduplicateCandidates(allCandidates, dedupWindowDays);
  const dncFilteredCount = foundCount - survivors.length;

  // Step 4: Enrich each survivor in parallel; merge profiles
  const enrichedCandidates: Array<{
    candidate: DiscoveryCandidate;
    profile: Partial<ViabilityProfile>;
  }> = [];

  await Promise.allSettled(
    survivors.map(async (candidate) => {
      const domain = candidate.domain ?? null;
      const name = candidate.businessName;

      const enrichResults = await Promise.allSettled([
        enrichPageSpeed(domain, name),
        enrichDomainAge(domain),
        enrichInstagram(domain, name, metaAccessToken ?? ""),
        enrichYouTube(name, youtubeApiKey ?? ""),
        enrichWebsiteScrape(domain),
        enrichMapsPhotos(name, locationCentre, serpApiKey ?? ""),
      ]);

      const partials: Partial<ViabilityProfile>[] = [candidate.partialProfile];

      for (const r of enrichResults) {
        if (r.status === "fulfilled") {
          partials.push(r.value);
        }
        // Failures are silently degraded — individual enricher errors do not abort the run
      }

      const merged = mergeProfiles(partials);
      enrichedCandidates.push({ candidate, profile: merged });
    }),
  );

  // Step 6: Score against both rulesets; discard if fails floor on both
  interface ScoredCandidate {
    candidate: DiscoveryCandidate;
    profile: Partial<ViabilityProfile>;
    winningScore: number;
    winningTrack: "saas" | "retainer";
    saasResult: ReturnType<typeof scoreForSaasTrack>;
    retainerResult: ReturnType<typeof scoreForRetainerTrack>;
  }

  const qualifiedCandidates: ScoredCandidate[] = [];

  for (const { candidate, profile } of enrichedCandidates) {
    const saasResult = scoreForSaasTrack(profile);
    const retainerResult = scoreForRetainerTrack(profile);

    // Discard if fails floor on both tracks
    if (!saasResult.qualifies && !retainerResult.qualifies) continue;

    // Winner-takes-all track assignment
    const winningTrack = saasResult.score >= retainerResult.score ? "saas" : "retainer";
    const winningScore = Math.max(saasResult.score, retainerResult.score);

    qualifiedCandidates.push({ candidate, profile, winningScore, winningTrack, saasResult, retainerResult });
  }

  // Step 7: Take top min(target, qualified.length) by score
  qualifiedCandidates.sort((a, b) => b.winningScore - a.winningScore);
  const topCandidates = qualifiedCandidates.slice(0, target);

  // Step 8, 9, 10: Insert candidates, discover contacts, generate drafts
  let draftedCount = 0;
  const standingBrief = await settings.get("lead_generation.standing_brief");

  for (const sc of topCandidates) {
    const candidateId = crypto.randomUUID();

    // Step 8: Insert lead_candidates row
    await db.insert(leadCandidates).values({
      id: candidateId,
      company_name: sc.candidate.businessName,
      domain: sc.candidate.domain ?? undefined,
      viability_profile_json: sc.profile,
      saas_score: sc.saasResult.score,
      retainer_score: sc.retainerResult.score,
      qualified_track: sc.winningTrack,
      scoring_debug_json: { saas: sc.saasResult, retainer: sc.retainerResult },
      lead_run_id: runId,
      sourced_from: sc.candidate.source,
    });

    // Step 9: Discover contact email
    const domain = sc.candidate.domain;
    if (!domain) {
      await db.update(leadCandidates)
        .set({ skipped_at: new Date(), skipped_reason: "no_domain" })
        .where(eq(leadCandidates.id, candidateId));
      continue;
    }

    const discovery = await discoverContactEmail(domain);

    if (!discovery) {
      await db.update(leadCandidates)
        .set({ skipped_at: new Date(), skipped_reason: "no_contact_email" })
        .where(eq(leadCandidates.id, candidateId));
      continue;
    }

    await db.update(leadCandidates)
      .set({
        contact_email: discovery.email,
        contact_name: discovery.name,
        contact_role: discovery.role,
        email_confidence: discovery.email_confidence,
      })
      .where(eq(leadCandidates.id, candidateId));

    // Step 10: Generate outreach draft
    const draft = await generateDraft({
      track: sc.winningTrack,
      touchKind: "first_touch",
      touchIndex: 0,
      viabilityProfile: sc.profile as ViabilityProfile,
      standingBrief,
      priorTouches: [],
      recentBlogPosts: [],
      contactInfo: {
        name: discovery.name,
        email: discovery.email,
        role: discovery.role,
        company: sc.candidate.businessName,
      },
    });

    const draftId = crypto.randomUUID();
    await db.insert(outreachDrafts).values({
      id: draftId,
      candidate_id: candidateId,
      touch_kind: "first_touch",
      touch_index: 0,
      subject: draft.subject,
      body_markdown: draft.bodyMarkdown,
      model_used: draft.modelUsed,
      prompt_version: draft.promptVersion,
      generation_ms: draft.generationMs,
    });

    await db.update(leadCandidates)
      .set({ pending_draft_id: draftId })
      .where(eq(leadCandidates.id, candidateId));

    draftedCount++;
  }

  // Step 12: Insert lead_run summary row
  return persistRun({
    id: runId,
    trigger,
    startedAt,
    foundCount,
    dncFilteredCount,
    qualifiedCount: topCandidates.length,
    draftedCount,
    warmupCap: warmup.cap,
    effectiveCap: target,
    cappedReason: null,
    error: null,
    perSourceErrors,
  });
}

// ── Internal: persist the run audit row ──────────────────────────────────────

interface PersistArgs {
  id: string;
  trigger: "scheduled" | "run_now" | "manual_brief";
  startedAt: Date;
  foundCount: number;
  dncFilteredCount: number;
  qualifiedCount: number;
  draftedCount: number;
  warmupCap: number;
  effectiveCap: number;
  cappedReason: string | null;
  error: string | null;
  perSourceErrors: Record<string, string>;
}

async function persistRun(args: PersistArgs): Promise<LeadRunSummary> {
  const completedAt = new Date();

  await db.insert(leadRuns).values({
    id: args.id,
    trigger: args.trigger,
    run_started_at: args.startedAt,
    run_completed_at: completedAt,
    found_count: args.foundCount,
    dnc_filtered_count: args.dncFilteredCount,
    qualified_count: args.qualifiedCount,
    drafted_count: args.draftedCount,
    warmup_cap_at_run: args.warmupCap,
    effective_cap_at_run: args.effectiveCap,
    capped_reason: args.cappedReason,
    error: args.error,
    per_source_errors_json: Object.keys(args.perSourceErrors).length > 0
      ? args.perSourceErrors
      : null,
  });

  return {
    id: args.id,
    trigger: args.trigger,
    found_count: args.foundCount,
    dnc_filtered_count: args.dncFilteredCount,
    qualified_count: args.qualifiedCount,
    warmup_cap_at_run: args.warmupCap,
    effective_cap_at_run: args.effectiveCap,
    capped_reason: args.cappedReason,
    error: args.error,
    per_source_errors: args.perSourceErrors,
    started_at_ms: args.startedAt.getTime(),
    completed_at_ms: completedAt.getTime(),
  };
}
