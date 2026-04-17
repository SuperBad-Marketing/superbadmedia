/**
 * CE-2 tests — keyword research pipeline, rankability scoring, topic queue.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Authority scoring (pure, no mocks needed) ──────────────────────

import {
  computeAuthorityScore,
  isHighAuthority,
} from "@/lib/content-engine/rankability";
import type { SerpResult } from "@/lib/content-engine/research";

function makeSerpResult(domain: string): SerpResult {
  return {
    position: 1,
    title: `Result from ${domain}`,
    link: `https://${domain}/page`,
    domain,
    snippet: "snippet",
  };
}

describe("CE-2 — domain authority heuristic", () => {
  it("returns 70 for empty results (wide open SERP)", () => {
    expect(computeAuthorityScore([])).toBe(70);
  });

  it("returns 0 when all 10 results are high-authority", () => {
    const results = [
      "google.com",
      "youtube.com",
      "facebook.com",
      "amazon.com",
      "wikipedia.org",
      "twitter.com",
      "reddit.com",
      "linkedin.com",
      "apple.com",
      "microsoft.com",
    ].map(makeSerpResult);
    expect(computeAuthorityScore(results)).toBe(0);
  });

  it("scores 70 when zero results are high-authority", () => {
    const results = [
      "smallbiz.com.au",
      "localbaker.com",
      "myhometown.org",
    ].map(makeSerpResult);
    expect(computeAuthorityScore(results)).toBe(70);
  });

  it("reduces score by 7 per high-authority result", () => {
    const results = [
      makeSerpResult("google.com"),
      makeSerpResult("smallbiz.com.au"),
      makeSerpResult("reddit.com"),
      makeSerpResult("myblog.net"),
    ];
    // 2 high-auth → 70 - 14 = 56
    expect(computeAuthorityScore(results)).toBe(56);
  });
});

describe("CE-2 — isHighAuthority", () => {
  it("matches exact domain", () => {
    expect(isHighAuthority("google.com")).toBe(true);
    expect(isHighAuthority("wikipedia.org")).toBe(true);
  });

  it("matches subdomain of high-authority domain", () => {
    expect(isHighAuthority("blog.google.com")).toBe(true);
    expect(isHighAuthority("en.wikipedia.org")).toBe(true);
  });

  it("strips www prefix", () => {
    expect(isHighAuthority("www.reddit.com")).toBe(true);
  });

  it("rejects unknown domains", () => {
    expect(isHighAuthority("superbadmedia.com.au")).toBe(false);
    expect(isHighAuthority("randomsite.xyz")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isHighAuthority("Google.com")).toBe(true);
    expect(isHighAuthority("REDDIT.COM")).toBe(true);
  });
});

// ── fetchAndExtractText (cheerio scraping) ──────────────────────────

import { fetchAndExtractText } from "@/lib/content-engine/rankability";

describe("CE-2 — fetchAndExtractText", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts text from a simple HTML page", async () => {
    const html = `<html><body>
      <nav>Nav stuff</nav>
      <article><h1>Hello</h1><p>This is the main content.</p></article>
      <footer>Footer</footer>
    </body></html>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 }),
    );

    const text = await fetchAndExtractText("https://example.com/page");
    expect(text).toContain("Hello");
    expect(text).toContain("main content");
    expect(text).not.toContain("Nav stuff");
    expect(text).not.toContain("Footer");
  });

  it("returns null on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Not Found", { status: 404 }),
    );

    const text = await fetchAndExtractText("https://example.com/404");
    expect(text).toBeNull();
  });

  it("returns null on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("network error"),
    );

    const text = await fetchAndExtractText("https://example.com/fail");
    expect(text).toBeNull();
  });

  it("truncates content to ~2000 chars", async () => {
    const longContent = "A".repeat(5000);
    const html = `<html><body><article>${longContent}</article></body></html>`;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 }),
    );

    const text = await fetchAndExtractText("https://example.com/long");
    expect(text).not.toBeNull();
    expect(text!.length).toBeLessThanOrEqual(2000);
  });
});

// ── Gap analysis response parsing ────────────────────────────────────

// We test the parsing indirectly via the public `analyseContentGaps`
// by mocking both fetch (for page scraping) and invokeLlmText (for Haiku).

import { analyseContentGaps } from "@/lib/content-engine/rankability";

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(async () => ({ sent: true, messageId: "mock" })),
}));

import { invokeLlmText } from "@/lib/ai/invoke";
const mockInvokeLlm = vi.mocked(invokeLlmText);

describe("CE-2 — analyseContentGaps", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Re-setup the mock after restoreAllMocks
    mockInvokeLlm.mockReset();
  });

  it("returns parsed gaps from Haiku response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        "<html><body><article>Some content about marketing</article></body></html>",
        { status: 200 },
      ),
    );

    mockInvokeLlm.mockResolvedValueOnce(
      JSON.stringify([
        {
          angle: "Local SEO specifics",
          reasoning: "None of the top pages cover local SEO tactics",
        },
      ]),
    );

    const gaps = await analyseContentGaps("marketing tips", [
      makeSerpResult("example.com"),
    ]);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].angle).toBe("Local SEO specifics");
  });

  it("returns empty array when no pages could be fetched", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network error"),
    );

    const gaps = await analyseContentGaps("marketing tips", [
      makeSerpResult("example.com"),
    ]);

    expect(gaps).toEqual([]);
    expect(mockInvokeLlm).not.toHaveBeenCalled();
  });

  it("returns empty array on LLM failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body><article>Content</article></body></html>", {
        status: 200,
      }),
    );

    mockInvokeLlm.mockRejectedValueOnce(new Error("LLM down"));

    const gaps = await analyseContentGaps("marketing tips", [
      makeSerpResult("example.com"),
    ]);

    expect(gaps).toEqual([]);
  });

  it("caps content gaps at 3", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body><article>Content</article></body></html>", {
        status: 200,
      }),
    );

    mockInvokeLlm.mockResolvedValueOnce(
      JSON.stringify([
        { angle: "Gap 1", reasoning: "R1" },
        { angle: "Gap 2", reasoning: "R2" },
        { angle: "Gap 3", reasoning: "R3" },
        { angle: "Gap 4", reasoning: "R4" },
        { angle: "Gap 5", reasoning: "R5" },
      ]),
    );

    const gaps = await analyseContentGaps("seo", [
      makeSerpResult("example.com"),
    ]);

    expect(gaps).toHaveLength(3);
  });

  it("handles markdown-fenced JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body><article>Content</article></body></html>", {
        status: 200,
      }),
    );

    mockInvokeLlm.mockResolvedValueOnce(
      '```json\n[{"angle": "test", "reasoning": "test reason"}]\n```',
    );

    const gaps = await analyseContentGaps("seo", [
      makeSerpResult("example.com"),
    ]);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].angle).toBe("test");
  });
});

// ── High-authority domains data file ──────────────────────────────────

import highAuthorityDomains from "@/data/high-authority-domains.json";

describe("CE-2 — high-authority-domains.json", () => {
  it("contains at least 400 domains", () => {
    expect(highAuthorityDomains.length).toBeGreaterThanOrEqual(400);
  });

  it("contains expected domains", () => {
    const domainSet = new Set(highAuthorityDomains);
    expect(domainSet.has("google.com")).toBe(true);
    expect(domainSet.has("wikipedia.org")).toBe(true);
    expect(domainSet.has("reddit.com")).toBe(true);
    expect(domainSet.has("forbes.com")).toBe(true);
    expect(domainSet.has("smh.com.au")).toBe(true);
  });

  it("contains no duplicates", () => {
    const domainSet = new Set(highAuthorityDomains);
    expect(domainSet.size).toBe(highAuthorityDomains.length);
  });

  it("all entries are lowercase strings", () => {
    for (const domain of highAuthorityDomains) {
      expect(typeof domain).toBe("string");
      expect(domain).toBe(domain.toLowerCase());
    }
  });
});

// ── getCredential ────────────────────────────────────────────────────

import { getCredential } from "@/lib/integrations/getCredential";

describe("CE-2 — getCredential", () => {
  it("returns null when no active connection exists", async () => {
    const result = await getCredential("serpapi");
    expect(result).toBeNull();
  });
});

// ── Scheduled task handler ───────────────────────────────────────────

import {
  handleContentKeywordResearch,
  ContentKeywordResearchPayloadSchema,
} from "@/lib/scheduled-tasks/handlers/content-keyword-research";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";

describe("CE-2 — content_keyword_research handler", () => {
  it("validates payload schema", () => {
    expect(
      ContentKeywordResearchPayloadSchema.safeParse({ company_id: "abc" })
        .success,
    ).toBe(true);
    expect(
      ContentKeywordResearchPayloadSchema.safeParse({}).success,
    ).toBe(false);
    expect(
      ContentKeywordResearchPayloadSchema.safeParse({ company_id: "" })
        .success,
    ).toBe(false);
  });

  it("exits silently when kill switch is off", async () => {
    // Kill switch defaults to off — handler should return without error
    const fakeTask = {
      id: "test",
      task_type: "content_keyword_research",
      payload: { company_id: "test-co" },
      status: "running",
      run_at_ms: Date.now(),
      attempts: 0,
      idempotency_key: null,
      created_at_ms: Date.now(),
    } as ScheduledTaskRow;

    await expect(
      handleContentKeywordResearch(fakeTask),
    ).resolves.toBeUndefined();
  });

  it("throws on invalid payload", async () => {
    // Temporarily enable the kill switch
    const { killSwitches: ks } = await import("@/lib/kill-switches");
    const original = ks.content_automations_enabled;
    ks.content_automations_enabled = true;

    const fakeTask = {
      id: "test",
      task_type: "content_keyword_research",
      payload: {},
      status: "running",
      run_at_ms: Date.now(),
      attempts: 0,
      idempotency_key: null,
      created_at_ms: Date.now(),
    } as ScheduledTaskRow;

    await expect(handleContentKeywordResearch(fakeTask)).rejects.toThrow(
      "invalid payload",
    );

    ks.content_automations_enabled = original;
  });
});

// ── HANDLER_REGISTRY includes content_keyword_research ───────────────

import { HANDLER_REGISTRY } from "@/lib/scheduled-tasks/handlers";

describe("CE-2 — handler registry", () => {
  it("includes content_keyword_research handler", () => {
    expect(HANDLER_REGISTRY.content_keyword_research).toBeDefined();
    expect(typeof HANDLER_REGISTRY.content_keyword_research).toBe("function");
  });
});
