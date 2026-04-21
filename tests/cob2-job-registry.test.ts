import { describe, expect, it } from "vitest";
import {
  JOB_REGISTRY,
  REGISTERED_JOB_KEYS,
  getJobEntry,
  getJobBands,
  isJobRegistered,
  getJobVendor,
  getJobDisabledUntil,
  getRegisteredJobsByVendor,
  type JobBands,
} from "@/lib/observatory/job-registry";
import { MODELS, MODEL_JOB_SLUGS, type ModelJobSlug } from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// 1. Registry ↔ models.ts alignment
// ---------------------------------------------------------------------------

describe("Registry ↔ models.ts alignment", () => {
  it("every LLM job slug in models.ts has a registry entry", () => {
    const missing = MODEL_JOB_SLUGS.filter((slug) => !isJobRegistered(slug));
    expect(missing).toEqual([]);
  });

  it("every LLM entry has vendor 'anthropic'", () => {
    for (const slug of MODEL_JOB_SLUGS) {
      expect(getJobVendor(slug)).toBe("anthropic");
    }
  });

  it("LLM entry count matches models.ts count", () => {
    const llmCount = REGISTERED_JOB_KEYS.filter(
      (k) => JOB_REGISTRY[k]!.vendor === "anthropic",
    ).length;
    expect(llmCount).toBe(MODEL_JOB_SLUGS.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Band structure validation
// ---------------------------------------------------------------------------

describe("Band structure validation", () => {
  it("every registry entry has all four band fields", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      const bands = getJobBands(key)!;
      expect(bands).toBeDefined();
      expect(typeof bands.per_call_ceiling_aud).toBe("number");
      expect(typeof bands.daily_ceiling_aud).toBe("number");
      expect(typeof bands.learned_band_multiplier).toBe("number");
      expect(
        bands.rate_override === null || typeof bands.rate_override === "number",
      ).toBe(true);
    }
  });

  it("per_call_ceiling_aud is non-negative for all jobs", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      expect(getJobBands(key)!.per_call_ceiling_aud).toBeGreaterThanOrEqual(0);
    }
  });

  it("daily_ceiling_aud is non-negative for all jobs", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      expect(getJobBands(key)!.daily_ceiling_aud).toBeGreaterThanOrEqual(0);
    }
  });

  it("learned_band_multiplier is positive for all jobs", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      expect(getJobBands(key)!.learned_band_multiplier).toBeGreaterThan(0);
    }
  });

  it("daily_ceiling_aud >= per_call_ceiling_aud for paid jobs", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      const bands = getJobBands(key)!;
      if (bands.per_call_ceiling_aud > 0) {
        expect(bands.daily_ceiling_aud).toBeGreaterThanOrEqual(
          bands.per_call_ceiling_aud,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Tier-based band defaults
// ---------------------------------------------------------------------------

describe("Tier-based band defaults", () => {
  it("Opus jobs have per_call_ceiling >= $1.50 AUD", () => {
    for (const slug of MODEL_JOB_SLUGS) {
      if (MODELS[slug] === "opus") {
        expect(getJobBands(slug)!.per_call_ceiling_aud).toBeGreaterThanOrEqual(1.5);
      }
    }
  });

  it("Haiku jobs have per_call_ceiling <= $0.10 AUD", () => {
    for (const slug of MODEL_JOB_SLUGS) {
      if (MODELS[slug] === "haiku") {
        expect(getJobBands(slug)!.per_call_ceiling_aud).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("Sonnet jobs have per_call_ceiling between $0.10 and $1.50 AUD", () => {
    for (const slug of MODEL_JOB_SLUGS) {
      if (MODELS[slug] === "sonnet") {
        const ceiling = getJobBands(slug)!.per_call_ceiling_aud;
        expect(ceiling).toBeGreaterThanOrEqual(0.1);
        expect(ceiling).toBeLessThanOrEqual(1.5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Heavy Opus overrides
// ---------------------------------------------------------------------------

describe("Heavy Opus overrides", () => {
  const heavyJobs: ModelJobSlug[] = [
    "cockpit-brief",
    "observatory-diagnose-cost-anomaly",
    "brand-dna-generate-prose-portrait",
    "six-week-plan-strategy",
    "six-week-plan-weeks",
    "content-generate-blog-post",
  ];

  it("heavy Opus jobs have higher per_call_ceiling than default", () => {
    for (const slug of heavyJobs) {
      expect(getJobBands(slug)!.per_call_ceiling_aud).toBeGreaterThan(1.5);
    }
  });

  it("cockpit-brief has the highest ceiling (aggregator)", () => {
    expect(getJobBands("cockpit-brief")!.per_call_ceiling_aud).toBe(5.0);
    expect(getJobBands("cockpit-brief")!.daily_ceiling_aud).toBe(150);
  });
});

// ---------------------------------------------------------------------------
// 5. Non-LLM vendor entries
// ---------------------------------------------------------------------------

describe("Non-LLM vendor entries", () => {
  const paidVendorJobs = [
    "serpapi.google_maps",
    "serpapi.google_maps_photos",
    "serpapi.google_ads_transparency",
    "hunter.domain_search",
    "stripe-balance-read",
    "stripe-balance-transactions-read",
    "resend-send",
    "resend-inbound-parse",
  ];

  const freeVendorJobs = [
    "meta.ad_library.search",
    "meta.instagram_business_discovery",
    "google.youtube.data_api",
    "google.pagespeed.run",
    "rdap.domain_lookup",
    "website.scrape",
    "hiring-portfolio-ingest-ig",
    "hiring-portfolio-ingest-vimeo",
    "sd-melbourne-weather",
    "graph-mail-read",
    "graph-mail-send",
    "graph-subscription-renew",
  ];

  it("all known non-LLM jobs are registered", () => {
    for (const job of [...paidVendorJobs, ...freeVendorJobs]) {
      expect(isJobRegistered(job)).toBe(true);
    }
  });

  it("paid vendor jobs have non-zero per_call_ceiling", () => {
    for (const job of paidVendorJobs) {
      expect(getJobBands(job)!.per_call_ceiling_aud).toBeGreaterThan(0);
    }
  });

  it("free vendor jobs have zero cost ceilings", () => {
    for (const job of freeVendorJobs) {
      const bands = getJobBands(job)!;
      expect(bands.per_call_ceiling_aud).toBe(0);
      expect(bands.daily_ceiling_aud).toBe(0);
    }
  });

  it("non-LLM vendor labels are correct", () => {
    expect(getJobVendor("serpapi.google_maps")).toBe("serpapi");
    expect(getJobVendor("hunter.domain_search")).toBe("hunter");
    expect(getJobVendor("meta.ad_library.search")).toBe("meta");
    expect(getJobVendor("google.youtube.data_api")).toBe("google");
    expect(getJobVendor("stripe-balance-read")).toBe("stripe");
    expect(getJobVendor("resend-send")).toBe("resend");
    expect(getJobVendor("graph-mail-read")).toBe("graph");
    expect(getJobVendor("sd-melbourne-weather")).toBe("weather");
  });
});

// ---------------------------------------------------------------------------
// 6. Lookup helpers
// ---------------------------------------------------------------------------

describe("Lookup helpers", () => {
  it("getJobEntry returns undefined for unknown jobs", () => {
    expect(getJobEntry("nonexistent-job")).toBeUndefined();
  });

  it("getJobBands returns undefined for unknown jobs", () => {
    expect(getJobBands("nonexistent-job")).toBeUndefined();
  });

  it("isJobRegistered returns false for unknown jobs", () => {
    expect(isJobRegistered("nonexistent-job")).toBe(false);
  });

  it("getJobDisabledUntil defaults to null", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      expect(getJobDisabledUntil(key)).toBeNull();
    }
  });

  it("getRegisteredJobsByVendor returns correct subsets", () => {
    const anthropicJobs = getRegisteredJobsByVendor("anthropic");
    expect(anthropicJobs.length).toBe(MODEL_JOB_SLUGS.length);
    const serpapiJobs = getRegisteredJobsByVendor("serpapi");
    expect(serpapiJobs.length).toBe(3);
    const stripeJobs = getRegisteredJobsByVendor("stripe");
    expect(stripeJobs.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 7. Registry integrity
// ---------------------------------------------------------------------------

describe("Registry integrity", () => {
  it("no duplicate keys", () => {
    const seen = new Set<string>();
    for (const key of REGISTERED_JOB_KEYS) {
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("every entry has a non-empty description", () => {
    for (const key of REGISTERED_JOB_KEYS) {
      const entry = getJobEntry(key)!;
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it("registry is frozen (immutable)", () => {
    expect(Object.isFrozen(JOB_REGISTRY)).toBe(true);
    expect(Object.isFrozen(REGISTERED_JOB_KEYS)).toBe(true);
  });

  it("total registry count = LLM jobs + non-LLM jobs", () => {
    const llmCount = MODEL_JOB_SLUGS.length;
    const nonLlmKeys = REGISTERED_JOB_KEYS.filter(
      (k) => JOB_REGISTRY[k]!.vendor !== "anthropic",
    );
    expect(REGISTERED_JOB_KEYS.length).toBe(llmCount + nonLlmKeys.length);
  });
});
