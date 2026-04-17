import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.mock is hoisted — factories must not reference outer variables.

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() =>
          Object.assign(Promise.resolve([]), {
            limit: () => Promise.resolve([]),
          }),
        ),
        innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    })),
  },
}));

vi.mock("@/lib/db/schema/lead-candidates", () => ({
  leadCandidates: { domain: "domain", created_at: "created_at" },
}));
vi.mock("@/lib/db/schema/companies", () => ({
  companies: { domain: "domain", id: "id" },
}));
vi.mock("@/lib/db/schema/deals", () => ({
  deals: { company_id: "company_id" },
}));
vi.mock("@/lib/db/schema/lead-runs", () => ({
  leadRuns: {},
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: { lead_gen_enabled: true },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      const defaults: Record<string, unknown> = {
        "lead_generation.daily_max_per_day": 20,
        "lead_generation.dedup_window_days": 30,
        "lead_generation.location_centre": "Melbourne, Australia",
        "lead_generation.location_radius_km": 25,
        "lead_generation.category": "cafes",
        "lead_generation.standing_brief": "",
      };
      return defaults[key] ?? null;
    }),
  },
}));

vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/lead-gen/sources", () => ({
  searchMetaAdLibrary: vi.fn().mockResolvedValue({ source: "meta_ad_library", candidates: [] }),
  searchGoogleMaps: vi.fn().mockResolvedValue({ source: "google_maps", candidates: [] }),
  searchGoogleAdsTransparency: vi.fn().mockResolvedValue({
    source: "google_ads_transparency",
    candidates: [],
  }),
}));

vi.mock("@/lib/lead-gen/enrichment", () => ({
  enrichPageSpeed: vi.fn().mockResolvedValue({}),
  enrichDomainAge: vi.fn().mockResolvedValue({}),
  enrichInstagram: vi.fn().mockResolvedValue({}),
  enrichYouTube: vi.fn().mockResolvedValue({}),
  enrichWebsiteScrape: vi.fn().mockResolvedValue({}),
  enrichMapsPhotos: vi.fn().mockResolvedValue({}),
  mergeProfiles: vi.fn((profiles: unknown[]) => profiles[0] ?? {}),
}));

vi.mock("@/lib/lead-gen/dnc", () => ({
  isBlockedFromOutreach: vi.fn().mockResolvedValue({ blocked: false, reason: null }),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { enforceWarmupCap } from "@/lib/lead-gen/warmup";
import { deduplicateCandidates } from "@/lib/lead-gen/dedup";
import { runLeadGenDaily } from "@/lib/lead-gen/orchestrator";
import { killSwitches } from "@/lib/kill-switches";
import { db } from "@/lib/db";
import settings from "@/lib/settings";
import {
  searchMetaAdLibrary,
  searchGoogleMaps,
  searchGoogleAdsTransparency,
} from "@/lib/lead-gen/sources";
import { isBlockedFromOutreach } from "@/lib/lead-gen/dnc";
import type { DiscoveryCandidate } from "@/lib/lead-gen/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandidate(domain: string): DiscoveryCandidate {
  return {
    businessName: `Business at ${domain}`,
    domain,
    location: "Melbourne, VIC",
    phone: null,
    source: "google_maps",
    partialProfile: {},
  };
}

function sourceResult(
  source: DiscoveryCandidate["source"],
  candidates: DiscoveryCandidate[],
) {
  return { source, candidates };
}

// ── enforceWarmupCap ──────────────────────────────────────────────────────────

describe("enforceWarmupCap (real — no DB row → day-1 defaults)", () => {
  it("returns day-1 defaults when no warmup row exists", async () => {
    const result = await enforceWarmupCap();
    expect(result).toEqual({ cap: 5, used: 0, remaining: 5, can_send: true });
  });

  it("can_send is true when remaining > 0", async () => {
    const result = await enforceWarmupCap();
    expect(result.can_send).toBe(true);
  });

  it("remaining equals cap minus used", async () => {
    const result = await enforceWarmupCap();
    expect(result.remaining).toBe(result.cap - result.used);
  });
});

// ── deduplicateCandidates ─────────────────────────────────────────────────────

describe("deduplicateCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isBlockedFromOutreach).mockResolvedValue({ blocked: false, reason: null });
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
        innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    } as unknown as ReturnType<typeof db.select>);
  });

  it("returns all candidates when no existing domains and no DNC blocks", async () => {
    const candidates = [makeCandidate("acme.com.au"), makeCandidate("beta.com.au")];
    const result = await deduplicateCandidates(candidates, 30);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input without hitting the DB", async () => {
    const result = await deduplicateCandidates([], 30);
    expect(result).toHaveLength(0);
    expect(vi.mocked(db.select)).not.toHaveBeenCalled();
  });

  it("filters candidate whose domain exists in lead_candidates within window", async () => {
    // First select → lead_candidates check returns existing domain
    // Second select → deals join (empty)
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ domain: "acme.com.au" }]),
          innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
      } as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
      } as unknown as ReturnType<typeof db.select>);

    const candidates = [makeCandidate("acme.com.au"), makeCandidate("beta.com.au")];
    const result = await deduplicateCandidates(candidates, 30);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("beta.com.au");
  });

  it("filters candidate whose domain has an existing deal company", async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
        })),
      } as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
          innerJoin: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([{ domain: "acme.com.au" }]),
          })),
        })),
      } as unknown as ReturnType<typeof db.select>);

    const candidates = [makeCandidate("acme.com.au"), makeCandidate("beta.com.au")];
    const result = await deduplicateCandidates(candidates, 30);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("beta.com.au");
  });

  it("filters DNC-blocked candidates", async () => {
    vi.mocked(isBlockedFromOutreach)
      .mockResolvedValueOnce({ blocked: true, reason: "domain" })
      .mockResolvedValueOnce({ blocked: false, reason: null });

    const candidates = [makeCandidate("blocked.com.au"), makeCandidate("clean.com.au")];
    const result = await deduplicateCandidates(candidates, 30);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("clean.com.au");
  });

  it("deduplicates within-batch duplicates (first occurrence wins)", async () => {
    const candidates = [makeCandidate("same.com.au"), makeCandidate("same.com.au")];
    const result = await deduplicateCandidates(candidates, 30);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe("same.com.au");
  });

  it("passes candidate with null domain without calling DNC check", async () => {
    const candidate: DiscoveryCandidate = {
      businessName: "No Domain Business",
      domain: null,
      location: null,
      phone: null,
      source: "meta_ad_library",
      partialProfile: {},
    };
    const result = await deduplicateCandidates([candidate], 30);
    expect(result).toHaveLength(1);
    expect(vi.mocked(isBlockedFromOutreach)).not.toHaveBeenCalled();
  });
});

// ── runLeadGenDaily ───────────────────────────────────────────────────────────

describe("runLeadGenDaily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset kill switch to enabled
    (killSwitches as Record<string, unknown>).lead_gen_enabled = true;

    // Reset settings to defaults
    vi.mocked(settings.get).mockImplementation(async (key: string) => {
      const defaults: Record<string, unknown> = {
        "lead_generation.daily_max_per_day": 20,
        "lead_generation.dedup_window_days": 30,
        "lead_generation.location_centre": "Melbourne, Australia",
        "lead_generation.location_radius_km": 25,
        "lead_generation.category": "cafes",
        "lead_generation.standing_brief": "",
      };
      return defaults[key] ?? null;
    });

    // Reset DB mocks
    vi.mocked(db.insert).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof db.insert>);
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() =>
          Object.assign(Promise.resolve([]), {
            limit: vi.fn().mockResolvedValue([]),
          }),
        ),
        innerJoin: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
      })),
    } as unknown as ReturnType<typeof db.select>);

    // Reset DNC
    vi.mocked(isBlockedFromOutreach).mockResolvedValue({ blocked: false, reason: null });

    // Reset source adapters to empty results
    vi.mocked(searchMetaAdLibrary).mockResolvedValue({
      source: "meta_ad_library",
      candidates: [],
    });
    vi.mocked(searchGoogleMaps).mockResolvedValue({
      source: "google_maps",
      candidates: [],
    });
    vi.mocked(searchGoogleAdsTransparency).mockResolvedValue({
      source: "google_ads_transparency",
      candidates: [],
    });
  });

  it("happy path — returns well-shaped run summary", async () => {
    vi.mocked(searchGoogleMaps).mockResolvedValue(
      sourceResult("google_maps", [makeCandidate("acme.com.au"), makeCandidate("beta.com.au")]),
    );

    const summary = await runLeadGenDaily("scheduled");

    expect(summary.trigger).toBe("scheduled");
    expect(summary.found_count).toBe(2);
    expect(summary.dnc_filtered_count).toBe(0);
    expect(summary.capped_reason).toBeNull();
    expect(summary.error).toBeNull();
    expect(typeof summary.id).toBe("string");
    expect(summary.started_at_ms).toBeLessThanOrEqual(summary.completed_at_ms);
    // Stub scoring disqualifies all → 0 qualified
    expect(summary.qualified_count).toBe(0);
  });

  it("inserts exactly one lead_run row", async () => {
    await runLeadGenDaily("scheduled");
    expect(vi.mocked(db.insert)).toHaveBeenCalledTimes(1);
  });

  it("kill-switch disabled — exits immediately, adapters never called", async () => {
    (killSwitches as Record<string, unknown>).lead_gen_enabled = false;

    const summary = await runLeadGenDaily("scheduled");

    expect(summary.capped_reason).toBe("kill_switch_disabled");
    expect(summary.found_count).toBe(0);
    expect(vi.mocked(searchGoogleMaps)).not.toHaveBeenCalled();
  });

  it("effective cap = 0 (daily_max = 0) — exits before calling adapters", async () => {
    vi.mocked(settings.get).mockImplementation(async (key: string) => {
      if (key === "lead_generation.daily_max_per_day") return 0;
      const defaults: Record<string, unknown> = {
        "lead_generation.dedup_window_days": 30,
        "lead_generation.location_centre": "Melbourne, Australia",
        "lead_generation.location_radius_km": 25,
        "lead_generation.category": "cafes",
      };
      return defaults[key] ?? null;
    });

    const summary = await runLeadGenDaily("scheduled");

    expect(summary.capped_reason).toBe("warmup_cap_exhausted");
    expect(summary.effective_cap_at_run).toBe(0);
    expect(vi.mocked(searchGoogleMaps)).not.toHaveBeenCalled();
  });

  it("source adapter rejection — run continues with remaining sources", async () => {
    vi.mocked(searchMetaAdLibrary).mockRejectedValue(new Error("Meta API timeout"));
    vi.mocked(searchGoogleMaps).mockResolvedValue(
      sourceResult("google_maps", [makeCandidate("acme.com.au")]),
    );

    const summary = await runLeadGenDaily("scheduled");

    expect(summary.found_count).toBe(1);
    expect(summary.per_source_errors["meta_ad_library"]).toContain("Meta API timeout");
    expect(summary.capped_reason).toBeNull();
  });

  it("source adapter returns fetchError — recorded in per_source_errors", async () => {
    vi.mocked(searchGoogleAdsTransparency).mockResolvedValue({
      source: "google_ads_transparency",
      candidates: [],
      fetchError: "Rate limited",
    });

    const summary = await runLeadGenDaily("run_now");

    expect(summary.per_source_errors["google_ads_transparency"]).toBe("Rate limited");
  });

  it("merges candidates from all 3 sources into found_count", async () => {
    vi.mocked(searchMetaAdLibrary).mockResolvedValue(
      sourceResult("meta_ad_library", [makeCandidate("alpha.com.au")]),
    );
    vi.mocked(searchGoogleMaps).mockResolvedValue(
      sourceResult("google_maps", [makeCandidate("beta.com.au")]),
    );
    vi.mocked(searchGoogleAdsTransparency).mockResolvedValue(
      sourceResult("google_ads_transparency", [makeCandidate("gamma.com.au")]),
    );

    const summary = await runLeadGenDaily("scheduled");
    expect(summary.found_count).toBe(3);
  });

  it("trigger type is passed through to the run summary", async () => {
    const summary = await runLeadGenDaily("manual_brief");
    expect(summary.trigger).toBe("manual_brief");
  });
});
