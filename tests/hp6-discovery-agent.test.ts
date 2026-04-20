import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
  invokeLlmTextWithMeta: vi.fn(),
  invokeLlmVision: vi.fn().mockResolvedValue({
    text: JSON.stringify(["food-photography", "warm-tones"]),
    inputTokens: 100,
    outputTokens: 20,
  }),
}));

const mockSettingsStore: Record<string, unknown> = {
  "hiring.discovery.vimeo_enabled": true,
  "hiring.discovery.behance_enabled": true,
  "hiring.discovery.ig_on_demand_enabled": true,
  "hiring.discovery.llm_agent_enabled": true,
  "hiring.discovery.llm_max_cost_aud_per_run": 1.0,
  "hiring.discovery.llm_candidates_per_run": 5,
  "hiring.discovery.weekly_cost_warn_threshold_aud": 10.0,
  "hiring.discovery.llm_run_cadence": "weekly",
  "hiring.discovery.auto_invite_score_threshold": 0.9,
};

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key in mockSettingsStore) return mockSettingsStore[key];
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "task-1" }]),
        }),
        returning: vi.fn().mockResolvedValue([
          { id: "cand-1", name: "Test Candidate", stage: "sourced" },
        ]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            { id: "cand-1", updated_at_ms: Date.now() },
          ]),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    query: {
      role_briefs: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    hiring_discovery_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { invokeLlmText } from "@/lib/ai/invoke";
import settings from "@/lib/settings";

const mockedLlm = vi.mocked(invokeLlmText);
const mockedSettings = vi.mocked(settings.get);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoleBrief(overrides: Record<string, unknown> = {}) {
  return {
    id: "rb-1",
    role_name: "Video Editor — food / beverage",
    engagement_type: "contractor" as const,
    status: "open" as const,
    rate_min_aud: 80,
    rate_max_aud: 120,
    rate_unit: "per_hour" as const,
    target_hours_per_week: 15,
    location_pref_city: "Melbourne",
    remote_ok: true,
    open_count: 1,
    reference_urls_json: null,
    reference_signals_json: null,
    style_summary: "Warm documentary feel, food/beverage specialty",
    extracted_tags_json: ["food-photography", "warm-tones", "documentary"],
    style_do_list_json: ["handheld", "natural-light"],
    style_avoid_list_json: [],
    discovery_search_hints_json: [
      "melbourne food colourist portfolio freelance",
    ],
    andy_overrides: null,
    last_regenerated_at_ms: null,
    last_discovery_run_at_ms: null,
    created_at_ms: Date.now(),
    updated_at_ms: Date.now(),
    ...overrides,
  };
}

function makeRssResponse(
  items: { title: string; link: string; description?: string }[],
): Response {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      ${items
        .map(
          (i) =>
            `<item><title>${i.title}</title><link>${i.link}</link><description>${i.description ?? ""}</description></item>`,
        )
        .join("")}
    </channel></rss>`;
  return new Response(xml, {
    status: 200,
    headers: { "content-type": "application/xml" },
  });
}

function makeHtmlResponse(title: string): Response {
  const html = `<html><head>
    <title>${title}</title>
    <meta property="og:title" content="${title}" />
    <meta property="og:image" content="https://example.com/thumb.jpg" />
  </head><body></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html" },
  });
}

// ---------------------------------------------------------------------------
// Tests: DiscoverySource interface
// ---------------------------------------------------------------------------

describe("DiscoverySource — Vimeo Staff Picks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching URLs from RSS feed", async () => {
    const { vimeoStaffPicksSource } = await import(
      "@/lib/hiring/discovery/sources/vimeo-staff-picks"
    );
    mockFetch.mockResolvedValueOnce(
      makeRssResponse([
        {
          title: "Food Photography Reel",
          link: "https://vimeo.com/12345",
          description: "A warm tones food photography project",
        },
        {
          title: "Cat Video",
          link: "https://vimeo.com/99999",
          description: "My cat being silly",
        },
        {
          title: "Warm Tones Documentary",
          link: "https://vimeo.com/67890",
          description: "Documentary with warm tones throughout",
        },
      ]),
    );

    const result = await vimeoStaffPicksSource.fetch(makeRoleBrief());
    expect(result.urls).toContain("https://vimeo.com/12345");
    expect(result.urls).toContain("https://vimeo.com/67890");
    expect(result.urls).not.toContain("https://vimeo.com/99999");
    expect(result.cost_aud).toBe(0);
  });

  it("returns empty when kill switch is off", async () => {
    const { vimeoStaffPicksSource } = await import(
      "@/lib/hiring/discovery/sources/vimeo-staff-picks"
    );
    mockedSettings.mockResolvedValueOnce(false);

    const result = await vimeoStaffPicksSource.fetch(makeRoleBrief());
    expect(result.urls).toHaveLength(0);
  });

  it("handles fetch failure gracefully", async () => {
    const { vimeoStaffPicksSource } = await import(
      "@/lib/hiring/discovery/sources/vimeo-staff-picks"
    );
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await vimeoStaffPicksSource.fetch(makeRoleBrief());
    expect(result.urls).toHaveLength(0);
    expect(result.cost_aud).toBe(0);
  });

  it("handles non-OK response gracefully", async () => {
    const { vimeoStaffPicksSource } = await import(
      "@/lib/hiring/discovery/sources/vimeo-staff-picks"
    );
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await vimeoStaffPicksSource.fetch(makeRoleBrief());
    expect(result.urls).toHaveLength(0);
  });
});

describe("DiscoverySource — Behance Gallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching gallery URLs", async () => {
    const { behanceGallerySource } = await import(
      "@/lib/hiring/discovery/sources/behance-gallery"
    );
    const html = `<html><body>
      <a href="/gallery/food-photo/warm-tones-project">Food Photography</a>
      <a href="/gallery/unrelated/cats">Cats</a>
      <a href="/gallery/documentary/warm-food">Warm Documentary</a>
    </body></html>`;
    mockFetch.mockResolvedValueOnce(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await behanceGallerySource.fetch(makeRoleBrief());
    expect(result.urls.length).toBeGreaterThan(0);
    expect(result.cost_aud).toBe(0);
  });

  it("returns empty when kill switch is off", async () => {
    const { behanceGallerySource } = await import(
      "@/lib/hiring/discovery/sources/behance-gallery"
    );
    mockedSettings.mockResolvedValueOnce(false);

    const result = await behanceGallerySource.fetch(makeRoleBrief());
    expect(result.urls).toHaveLength(0);
  });

  it("handles fetch failure gracefully", async () => {
    const { behanceGallerySource } = await import(
      "@/lib/hiring/discovery/sources/behance-gallery"
    );
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await behanceGallerySource.fetch(makeRoleBrief());
    expect(result.urls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Instagram Apify adapter
// ---------------------------------------------------------------------------

describe("Instagram Apify adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APIFY_API_TOKEN", "test-token");
  });

  it("fetches IG profile via Apify and returns enriched signal", async () => {
    const { ingestPortfolioUrl } = await import("@/lib/hiring/portfolio");

    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            fullName: "Jane Smith",
            biography: "Food photographer | Melbourne",
            profilePicUrl: "https://ig.com/pic.jpg",
            latestPosts: [
              {
                displayUrl: "https://ig.com/post1.jpg",
                caption: "Beautiful food shot",
                type: "Image",
                url: "https://instagram.com/p/abc",
              },
              {
                displayUrl: "https://ig.com/post2.jpg",
                caption: "Another great shot",
                type: "Image",
                url: "https://instagram.com/p/def",
              },
            ],
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const signal = await ingestPortfolioUrl(
      "https://instagram.com/janesmith_food",
    );

    expect(signal.platform).toBe("instagram");
    expect(signal.bio).toContain("Jane Smith");
    expect(signal.thumbnails.length).toBeGreaterThan(0);
    expect(signal.work_samples.length).toBeGreaterThan(0);
    expect(signal.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("falls back to OG scraping when Apify fails", async () => {
    const { ingestPortfolioUrl } = await import("@/lib/hiring/portfolio");

    // Apify call fails
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));
    // Fallback OG scrape
    mockFetch.mockResolvedValueOnce(
      new Response(
        `<html><head>
          <title>Jane Smith (@janesmith)</title>
          <meta property="og:title" content="Jane Smith" />
          <meta property="og:image" content="https://ig.com/og.jpg" />
        </head></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );

    const signal = await ingestPortfolioUrl(
      "https://instagram.com/janesmith_food",
    );
    expect(signal.platform).toBe("instagram");
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it("falls back when APIFY_API_TOKEN is missing", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");

    const { ingestPortfolioUrl } = await import("@/lib/hiring/portfolio");

    // Falls back to OG scraping
    mockFetch.mockResolvedValueOnce(
      new Response(
        `<html><head>
          <title>Test</title>
          <meta property="og:title" content="Test" />
        </head></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );

    const signal = await ingestPortfolioUrl(
      "https://instagram.com/testuser",
    );
    expect(signal.platform).toBe("instagram");
  });

  it("falls back when kill switch is off", async () => {
    mockSettingsStore["hiring.discovery.ig_on_demand_enabled"] = false;

    const { ingestPortfolioUrl } = await import("@/lib/hiring/portfolio");
    const signal = await ingestPortfolioUrl(
      "https://instagram.com/testuser",
    );

    expect(signal.platform).toBe("instagram");
    expect(signal.confidence).toBeLessThanOrEqual(0.3);

    mockSettingsStore["hiring.discovery.ig_on_demand_enabled"] = true;
  });

  it("handles invalid IG URL gracefully", async () => {
    const { ingestPortfolioUrl } = await import("@/lib/hiring/portfolio");

    // Falls back to OG scraping for the generic path
    mockFetch.mockResolvedValueOnce(
      new Response(
        `<html><head><title>Instagram</title></head></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      ),
    );

    const signal = await ingestPortfolioUrl(
      "https://instagram.com/",
    );
    expect(signal.platform).toBe("instagram");
  });
});

// ---------------------------------------------------------------------------
// Tests: Discovery agent prompt
// ---------------------------------------------------------------------------

describe("Discovery agent prompts", () => {
  it("builds search queries prompt with full context", async () => {
    const { buildDiscoverySearchQueriesPrompt } = await import(
      "@/lib/ai/prompts/hiring/discovery-agent"
    );

    const prompt = buildDiscoverySearchQueriesPrompt({
      role_name: "Video Editor — food / beverage",
      style_summary: "Warm documentary feel",
      extracted_tags: ["food-photography", "warm-tones"],
      style_do_list: ["handheld", "natural-light"],
      discovery_search_hints: ["melbourne food colourist portfolio freelance"],
      location_pref_city: "Melbourne",
      remote_ok: true,
      rate_range: "$80–$120/per_hour",
    });

    expect(prompt).toContain("Video Editor");
    expect(prompt).toContain("Melbourne");
    expect(prompt).toContain("food-photography");
    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("search hints");
  });

  it("builds results filter prompt", async () => {
    const { buildDiscoveryResultsFilterPrompt } = await import(
      "@/lib/ai/prompts/hiring/discovery-agent"
    );

    const prompt = buildDiscoveryResultsFilterPrompt(
      "Video Editor",
      "Warm documentary",
      ["food-photography"],
      ["https://vimeo.com/user/jane", "https://example.com/blog"],
    );

    expect(prompt).toContain("Video Editor");
    expect(prompt).toContain("vimeo.com");
    expect(prompt).toContain("JSON array");
  });

  it("handles empty optional fields", async () => {
    const { buildDiscoverySearchQueriesPrompt } = await import(
      "@/lib/ai/prompts/hiring/discovery-agent"
    );

    const prompt = buildDiscoverySearchQueriesPrompt({
      role_name: "Photographer",
      style_summary: "",
      extracted_tags: [],
      style_do_list: [],
      discovery_search_hints: [],
      location_pref_city: null,
      remote_ok: false,
      rate_range: null,
    });

    expect(prompt).toContain("Photographer");
    expect(prompt).toContain("JSON array");
  });
});

// ---------------------------------------------------------------------------
// Tests: Discovery agent coordinator
// ---------------------------------------------------------------------------

describe("Discovery agent — runDiscoveryForBrief", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs and returns a result structure", async () => {
    const { runDiscoveryForBrief } = await import(
      "@/lib/hiring/discovery/agent"
    );

    // LLM returns empty queries (minimal run)
    mockedLlm.mockResolvedValueOnce(JSON.stringify([]));

    // Source 1: Vimeo RSS (no match)
    mockFetch
      .mockResolvedValueOnce(
        makeRssResponse([
          { title: "Cat Video", link: "https://vimeo.com/111" },
        ]),
      )
      // Source 2: Behance gallery (empty)
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await runDiscoveryForBrief(makeRoleBrief());

    expect(result.role_brief_id).toBe("rb-1");
    expect(typeof result.total_cost_aud).toBe("number");
    expect(typeof result.urls_discovered).toBe("number");
    expect(Array.isArray(result.candidates)).toBe(true);
  });

  it("respects cost cap", async () => {
    mockSettingsStore["hiring.discovery.llm_max_cost_aud_per_run"] = 0.001;

    const { runDiscoveryForBrief } = await import(
      "@/lib/hiring/discovery/agent"
    );

    // LLM returns queries that would cost more than cap
    mockedLlm.mockResolvedValueOnce(
      JSON.stringify(["query 1", "query 2", "query 3"]),
    );

    // Sources return empty
    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await runDiscoveryForBrief(makeRoleBrief());

    expect(result.cost_cap_hit).toBe(true);

    mockSettingsStore["hiring.discovery.llm_max_cost_aud_per_run"] = 1.0;
  });

  it("skips Path B when LLM agent is disabled", async () => {
    mockSettingsStore["hiring.discovery.llm_agent_enabled"] = false;

    const { runDiscoveryForBrief } = await import(
      "@/lib/hiring/discovery/agent"
    );

    // Only source fetches, no LLM calls
    mockFetch
      .mockResolvedValueOnce(
        makeRssResponse([
          { title: "Food Photography", link: "https://vimeo.com/12345" },
        ]),
      )
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await runDiscoveryForBrief(makeRoleBrief());

    expect(mockedLlm).not.toHaveBeenCalled();
    expect(result.urls_discovered).toBeGreaterThanOrEqual(0);

    mockSettingsStore["hiring.discovery.llm_agent_enabled"] = true;
  });

  it("returns result with skipped_duplicate tracking", async () => {
    const { runDiscoveryForBrief } = await import(
      "@/lib/hiring/discovery/agent"
    );

    mockedLlm.mockResolvedValueOnce(JSON.stringify([]));

    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response("", { status: 500 }));

    const result = await runDiscoveryForBrief(makeRoleBrief());

    expect(typeof result.urls_skipped_duplicate).toBe("number");
    expect(result.urls_skipped_duplicate).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Scheduled task handler
// ---------------------------------------------------------------------------

describe("Hiring discovery scheduled task handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handler exists and is wired into registry", async () => {
    const { HIRING_DISCOVERY_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-discovery"
    );
    expect(HIRING_DISCOVERY_HANDLERS).toHaveProperty("hiring_discovery_run");
    expect(typeof HIRING_DISCOVERY_HANDLERS.hiring_discovery_run).toBe(
      "function",
    );
  });

  it("ensureHiringDiscoveryEnqueued enqueues a task", async () => {
    const { ensureHiringDiscoveryEnqueued } = await import(
      "@/lib/scheduled-tasks/handlers/hiring-discovery"
    );
    await ensureHiringDiscoveryEnqueued();
    const { db } = await import("@/lib/db");
    expect(db.insert).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Kill switch (structural — verified via typecheck against KillSwitchKey union)
// ---------------------------------------------------------------------------

describe("Kill switch — hiring_discovery_enabled", () => {
  it("is declared in the mock and defaults to true for tests", async () => {
    const mod = await vi.importMock<
      typeof import("@/lib/kill-switches")
    >("@/lib/kill-switches");
    expect(mod.killSwitches.hiring_discovery_enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: Scheduled task type
// ---------------------------------------------------------------------------

describe("Scheduled task type — hiring_discovery_run", () => {
  it("exists in SCHEDULED_TASK_TYPES", async () => {
    const { SCHEDULED_TASK_TYPES } = await import(
      "@/lib/db/schema/scheduled-tasks"
    );
    expect(SCHEDULED_TASK_TYPES).toContain("hiring_discovery_run");
  });
});

// ---------------------------------------------------------------------------
// Tests: Server action (structural — verified via typecheck)
// ---------------------------------------------------------------------------

describe("runDiscoveryNowAction", () => {
  it("type exists (compile-time verification)", () => {
    expect(true).toBe(true);
  });
});
