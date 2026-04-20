import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
  invokeLlmTextWithMeta: vi.fn(),
  invokeLlmVision: vi.fn().mockResolvedValue({
    text: JSON.stringify([
      "food-photography",
      "warm-tones",
      "natural-light",
      "handheld-documentary",
    ]),
    inputTokens: 500,
    outputTokens: 50,
  }),
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true;
      if (key === "hiring.discovery.behance_enabled") return true;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  ingestPortfolioUrl,
  detectPlatform,
  type PortfolioSignal,
} from "@/lib/hiring/portfolio";
import { invokeLlmVision } from "@/lib/ai/invoke";
import settings from "@/lib/settings";

const mockedVision = vi.mocked(invokeLlmVision);
const mockedSettings = vi.mocked(settings.get);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHtmlResponse(og: {
  title?: string;
  description?: string;
  image?: string;
}): Response {
  const html = `
    <html><head>
      <title>${og.title ?? ""}</title>
      ${og.title ? `<meta property="og:title" content="${og.title}" />` : ""}
      ${og.description ? `<meta property="og:description" content="${og.description}" />` : ""}
      ${og.image ? `<meta property="og:image" content="${og.image}" />` : ""}
    </head><body></body></html>
  `;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function makeVimeoOembedResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests: detectPlatform
// ---------------------------------------------------------------------------

describe("detectPlatform", () => {
  it("detects Vimeo", () => {
    expect(detectPlatform("https://vimeo.com/janedoe")).toBe("vimeo");
    expect(detectPlatform("https://VIMEO.COM/123")).toBe("vimeo");
  });

  it("detects Behance", () => {
    expect(detectPlatform("https://www.behance.net/janedoe")).toBe("behance");
  });

  it("detects Dribbble", () => {
    expect(detectPlatform("https://dribbble.com/janedoe")).toBe("dribbble");
  });

  it("detects Are.na", () => {
    expect(detectPlatform("https://www.are.na/janedoe")).toBe("arena");
  });

  it("detects YouTube", () => {
    expect(detectPlatform("https://youtube.com/c/janedoe")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc123")).toBe("youtube");
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://instagram.com/janedoe")).toBe("instagram");
  });

  it("detects LinkedIn", () => {
    expect(detectPlatform("https://linkedin.com/in/janedoe")).toBe("linkedin");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://tiktok.com/@janedoe")).toBe("tiktok");
  });

  it("returns personal for unknown domains", () => {
    expect(detectPlatform("https://janedoe.com/portfolio")).toBe("personal");
  });
});

// ---------------------------------------------------------------------------
// Tests: Vimeo ingestion
// ---------------------------------------------------------------------------

describe("ingestPortfolioUrl — Vimeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["food-photography", "warm-tones"]),
      inputTokens: 500,
      outputTokens: 50,
    });
  });

  it("fetches Vimeo oEmbed and returns enriched signal", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Summer Reel 2026",
        description: "A look at my food work",
        author_name: "Jane Doe",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.platform).toBe("vimeo");
    expect(signal.bio).toContain("Jane Doe");
    expect(signal.bio).toContain("food work");
    expect(signal.thumbnails).toContain("https://i.vimeocdn.com/video/thumb.jpg");
    expect(signal.work_samples[0].title).toBe("Summer Reel 2026");
    expect(signal.work_samples[0].mediaType).toBe("video");
    expect(signal.confidence).toBeGreaterThan(0.5);
  });

  it("returns degraded signal when Vimeo oEmbed fails", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("Not found", { status: 404 }),
    );

    const signal = await ingestPortfolioUrl("https://vimeo.com/private");

    expect(signal.platform).toBe("vimeo");
    expect(signal.confidence).toBeLessThanOrEqual(0.3);
    expect(signal.thumbnails).toHaveLength(0);
  });

  it("returns degraded signal when Vimeo kill switch is off", async () => {
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return false as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.platform).toBe("vimeo");
    expect(signal.confidence).toBeLessThanOrEqual(0.3);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("runs vision analysis when thumbnail is found", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(mockedVision).toHaveBeenCalledOnce();
    expect(signal.extracted_tags).toContain("food-photography");
    expect(signal.extracted_tags).toContain("warm-tones");
  });

  it("skips vision when no thumbnails are found", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({ title: "Reel" }),
    );

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(mockedVision).not.toHaveBeenCalled();
    expect(signal.extracted_tags).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: Behance ingestion
// ---------------------------------------------------------------------------

describe("ingestPortfolioUrl — Behance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["graphic-design", "branding"]),
      inputTokens: 500,
      outputTokens: 50,
    });
  });

  it("extracts OG metadata from Behance", async () => {
    mockFetch.mockResolvedValueOnce(
      makeHtmlResponse({
        title: "Jane Doe — Graphic Designer",
        description: "Melbourne-based visual storyteller",
        image: "https://mir-s3-cdn-cf.behance.net/project_thumb.jpg",
      }),
    );

    const signal = await ingestPortfolioUrl(
      "https://www.behance.net/janedoe",
    );

    expect(signal.platform).toBe("behance");
    expect(signal.bio).toContain("Jane Doe");
    expect(signal.thumbnails).toContain(
      "https://mir-s3-cdn-cf.behance.net/project_thumb.jpg",
    );
    expect(signal.confidence).toBeGreaterThan(0.4);
  });

  it("returns degraded signal when Behance kill switch is off", async () => {
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.behance_enabled") return false as never;
      throw new Error(`Unexpected: ${key}`);
    });

    const signal = await ingestPortfolioUrl(
      "https://www.behance.net/janedoe",
    );

    expect(signal.confidence).toBeLessThanOrEqual(0.3);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tests: Generic web / personal site
// ---------------------------------------------------------------------------

describe("ingestPortfolioUrl — personal site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["portrait-photography"]),
      inputTokens: 300,
      outputTokens: 30,
    });
  });

  it("extracts OG metadata from a personal site", async () => {
    mockFetch.mockResolvedValueOnce(
      makeHtmlResponse({
        title: "Jane Doe Photography",
        description: "Portraits and editorial",
        image: "https://janedoe.com/hero.jpg",
      }),
    );

    const signal = await ingestPortfolioUrl("https://janedoe.com/portfolio");

    expect(signal.platform).toBe("personal");
    expect(signal.bio).toContain("Jane Doe Photography");
    expect(signal.thumbnails).toContain("https://janedoe.com/hero.jpg");
    expect(signal.work_samples[0].thumbnailUrl).toBe(
      "https://janedoe.com/hero.jpg",
    );
  });

  it("handles fetch failure gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

    const signal = await ingestPortfolioUrl("https://janedoe.com/portfolio");

    expect(signal.platform).toBe("personal");
    expect(signal.confidence).toBeLessThanOrEqual(0.3);
    expect(signal.thumbnails).toHaveLength(0);
    expect(signal.extracted_tags).toHaveLength(0);
  });

  it("handles non-HTML response gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("binary data", {
        status: 200,
        headers: { "content-type": "application/pdf" },
      }),
    );

    const signal = await ingestPortfolioUrl("https://janedoe.com/resume.pdf");

    expect(signal.confidence).toBeLessThanOrEqual(0.3);
  });
});

// ---------------------------------------------------------------------------
// Tests: Vision LLM analysis
// ---------------------------------------------------------------------------

describe("vision LLM analysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });
  });

  it("bumps confidence when tags are extracted", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["food", "warm"]),
      inputTokens: 500,
      outputTokens: 30,
    });

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.extracted_tags.length).toBeGreaterThan(0);
    expect(signal.confidence).toBeGreaterThan(0.7);
  });

  it("handles non-JSON vision response gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );
    mockedVision.mockResolvedValue({
      text: "I can see food photography with warm tones",
      inputTokens: 500,
      outputTokens: 30,
    });

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.extracted_tags).toHaveLength(0);
  });

  it("handles vision LLM failure gracefully", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );
    mockedVision.mockRejectedValueOnce(new Error("API quota exceeded"));

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.extracted_tags).toHaveLength(0);
    expect(signal.confidence).toBeLessThanOrEqual(0.7);
  });

  it("strips markdown fences from vision response", async () => {
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );
    mockedVision.mockResolvedValue({
      text: '```json\n["food-photography","warm-tones"]\n```',
      inputTokens: 500,
      outputTokens: 30,
    });

    const signal = await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(signal.extracted_tags).toContain("food-photography");
    expect(signal.extracted_tags).toContain("warm-tones");
  });

  it("limits to 4 images for vision analysis", async () => {
    mockFetch.mockResolvedValueOnce(
      makeHtmlResponse({
        title: "Gallery",
        image: "https://example.com/1.jpg",
      }),
    );
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["tag-a"]),
      inputTokens: 500,
      outputTokens: 30,
    });

    await ingestPortfolioUrl("https://janedoe.com");

    const call = mockedVision.mock.calls[0];
    expect(call[0].imageUrls.length).toBeLessThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Tests: external call logging
// ---------------------------------------------------------------------------

describe("external call logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSettings.mockImplementation(async (key: string) => {
      if (key === "hiring.discovery.vimeo_enabled") return true as never;
      if (key === "hiring.discovery.behance_enabled") return true as never;
      if (key === "hiring.discovery.ig_on_demand_enabled") return true as never;
      throw new Error(`Unexpected: ${key}`);
    });
    mockedVision.mockResolvedValue({
      text: JSON.stringify(["tag"]),
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it("logs Vimeo API call to external_call_log", async () => {
    const { db } = await import("@/lib/db");
    mockFetch.mockResolvedValueOnce(
      makeVimeoOembedResponse({
        title: "Reel",
        thumbnail_url: "https://i.vimeocdn.com/video/thumb.jpg",
      }),
    );

    await ingestPortfolioUrl("https://vimeo.com/12345");

    expect(db.insert).toHaveBeenCalled();
  });
});
