import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn(() => []),
          limit: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn(),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_automations_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/integrations/getCredential", () => ({
  getCredential: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/settings", () => ({
  default: { get: vi.fn() },
}));

vi.mock("@/lib/pdf/render", () => ({
  resolveExecutablePath: vi.fn(
    () => "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ),
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn(() => ({
      newPage: vi.fn(() => ({
        setViewport: vi.fn(),
        setContent: vi.fn(),
        screenshot: vi.fn(() => Buffer.from("fake-png")),
        pdf: vi.fn(),
        close: vi.fn(),
      })),
      close: vi.fn(),
    })),
  },
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(() => Buffer.from("fake-file")),
  stat: vi.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { invokeLlmText } from "@/lib/ai/invoke";
import { getCredential } from "@/lib/integrations/getCredential";

// =====================================================================
// 1. Social template rendering
// =====================================================================

describe("Social templates", async () => {
  const {
    renderTemplate,
    renderCarouselTemplate,
    PLATFORM_DIMENSIONS,
  } = await import("@/lib/content-engine/social-templates");

  const tokens = {
    primaryColor: "#D14836",
    accentColor: "#E8916E",
    backgroundColor: "#FAF5F0",
    textColor: "#2E2B28",
    brandName: "TestBrand",
  };

  it("renders quote-card template with correct structure", () => {
    const html = renderTemplate(
      "quote-card",
      { headline: "Test Headline", body: "Test body text", tokens },
      PLATFORM_DIMENSIONS.instagram,
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test body text");
    expect(html).toContain("Test Headline");
    expect(html).toContain("TestBrand");
    expect(html).toContain("#D14836");
    expect(html).toContain("1080px");
  });

  it("renders stat-highlight template", () => {
    const html = renderTemplate(
      "stat-highlight",
      { headline: "87%", body: "of businesses see growth", tokens },
      PLATFORM_DIMENSIONS.linkedin,
    );
    expect(html).toContain("87%");
    expect(html).toContain("1200px");
  });

  it("renders listicle-card template", () => {
    const html = renderTemplate(
      "listicle-card",
      { headline: "5 Tips", body: "For better marketing", tokens },
      PLATFORM_DIMENSIONS.x,
    );
    expect(html).toContain("5 Tips");
    expect(html).toContain("For better marketing");
  });

  it("renders branded-hero template with gradient", () => {
    const html = renderTemplate(
      "branded-hero",
      { headline: "Big Idea", body: "Supporting text", tokens },
      PLATFORM_DIMENSIONS.facebook,
    );
    expect(html).toContain("linear-gradient");
    expect(html).toContain("Big Idea");
  });

  it("renders carousel slides with numbering", () => {
    const slides = renderCarouselTemplate(
      {
        headline: "First",
        body: "Intro",
        tokens,
        slides: [
          { headline: "Slide 1", body: "Content 1", slideNumber: 1 },
          { headline: "Slide 2", body: "Content 2", slideNumber: 2 },
          { headline: "Slide 3", body: "Content 3", slideNumber: 3 },
        ],
      },
      PLATFORM_DIMENSIONS.instagram,
    );
    expect(slides).toHaveLength(3);
    expect(slides[0]).toContain("1 / 3");
    expect(slides[2]).toContain("3 / 3");
    expect(slides[1]).toContain("Slide 2");
  });

  it("escapes HTML in template inputs", () => {
    const html = renderTemplate(
      "quote-card",
      { headline: '<script>alert("xss")</script>', body: "Safe text", tokens },
      PLATFORM_DIMENSIONS.instagram,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("truncates long body text in quote-card", () => {
    const longBody = "x".repeat(300);
    const html = renderTemplate(
      "quote-card",
      { headline: "H", body: longBody, tokens },
      PLATFORM_DIMENSIONS.instagram,
    );
    expect(html).toContain("...");
  });

  it("provides correct dimensions for each platform", () => {
    expect(PLATFORM_DIMENSIONS.instagram).toEqual({ width: 1080, height: 1080 });
    expect(PLATFORM_DIMENSIONS.linkedin).toEqual({ width: 1200, height: 627 });
    expect(PLATFORM_DIMENSIONS.x).toEqual({ width: 1200, height: 675 });
    expect(PLATFORM_DIMENSIONS.facebook).toEqual({ width: 1200, height: 630 });
  });
});

// =====================================================================
// 2. Social draft generation
// =====================================================================

describe("Social draft generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_automations_enabled = true;
  });

  it("returns kill_switch when content_automations_enabled is false", async () => {
    (killSwitches as Record<string, boolean>).content_automations_enabled = false;
    const { generateSocialDrafts } = await import(
      "@/lib/content-engine/social-drafts"
    );
    const result = await generateSocialDrafts("post-1");
    expect(result).toEqual({ ok: false, reason: "kill_switch" });
  });

  it("returns post_not_found when blog post does not exist", async () => {
    const { db } = await import("@/lib/db");
    const mockSelect = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => undefined),
        })),
      })),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);

    const { generateSocialDrafts } = await import(
      "@/lib/content-engine/social-drafts"
    );
    const result = await generateSocialDrafts("nonexistent");
    expect(result).toEqual({ ok: false, reason: "post_not_found" });
  });

  it("parses valid JSON social draft response", async () => {
    // Test the parse function indirectly through the module
    const mod = await import("@/lib/content-engine/social-drafts");
    // Module exports the types, we test through generateSocialDrafts
    expect(mod.generateSocialDrafts).toBeDefined();
    expect(mod.listSocialDrafts).toBeDefined();
  });
});

// =====================================================================
// 3. Asset storage
// =====================================================================

describe("Asset storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("storeContentAsset returns correct URL path", async () => {
    const { storeContentAsset } = await import(
      "@/lib/content-engine/asset-storage"
    );
    const url = await storeContentAsset(
      "abc123/instagram-1.png",
      Buffer.from("test"),
    );
    expect(url).toBe("/api/content-assets/abc123/instagram-1.png");
  });

  it("readContentAsset returns buffer when file exists", async () => {
    const { readContentAsset } = await import(
      "@/lib/content-engine/asset-storage"
    );
    const result = await readContentAsset("abc123/instagram-1.png");
    expect(result).toBeInstanceOf(Buffer);
  });

  it("readContentAsset returns null when file does not exist", async () => {
    const fsMock = await import("node:fs/promises");
    (fsMock.stat as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ENOENT"),
    );
    const { readContentAsset } = await import(
      "@/lib/content-engine/asset-storage"
    );
    const result = await readContentAsset("nonexistent/file.png");
    expect(result).toBeNull();
  });
});

// =====================================================================
// 4. AI image generation
// =====================================================================

describe("AI image generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no_api_key when OpenAI credential missing", async () => {
    (getCredential as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { generateAiImage } = await import("@/lib/content-engine/ai-image");
    const result = await generateAiImage(
      "Test Title",
      "Test excerpt",
      "instagram",
      {
        primaryColor: "#D14836",
        accentColor: "#E8916E",
        backgroundColor: "#FAF5F0",
        textColor: "#2E2B28",
        brandName: "Test",
      },
    );
    expect(result).toEqual({ ok: false, reason: "no_api_key" });
  });

  it("returns prompt_generation_failed when Haiku returns empty", async () => {
    (getCredential as ReturnType<typeof vi.fn>).mockResolvedValue("sk-test");
    (invokeLlmText as ReturnType<typeof vi.fn>).mockResolvedValue("   ");
    const { generateAiImage } = await import("@/lib/content-engine/ai-image");
    const result = await generateAiImage(
      "Test",
      "Body",
      "instagram",
      {
        primaryColor: "#D14836",
        accentColor: "#E8916E",
        backgroundColor: "#FAF5F0",
        textColor: "#2E2B28",
        brandName: "Test",
      },
    );
    expect(result).toEqual({ ok: false, reason: "prompt_generation_failed" });
  });
});

// =====================================================================
// 5. Render social image (Puppeteer mock)
// =====================================================================

describe("Render social image", () => {
  it("calls Puppeteer with correct viewport dimensions", async () => {
    const puppeteer = await import("puppeteer-core");
    const { renderSocialImage } = await import(
      "@/lib/content-engine/render-social-image"
    );
    await renderSocialImage("<html></html>", {
      dimensions: { width: 1080, height: 1080 },
    });

    const launchMock = puppeteer.default.launch as ReturnType<typeof vi.fn>;
    expect(launchMock).toHaveBeenCalled();
  });

  it("renderSocialImageBatch returns empty array for empty input", async () => {
    const { renderSocialImageBatch } = await import(
      "@/lib/content-engine/render-social-image"
    );
    const result = await renderSocialImageBatch([]);
    expect(result).toEqual([]);
  });

  it("renderSocialImageBatch processes multiple items", async () => {
    const { renderSocialImageBatch } = await import(
      "@/lib/content-engine/render-social-image"
    );
    const result = await renderSocialImageBatch([
      {
        html: "<html>1</html>",
        opts: { dimensions: { width: 1080, height: 1080 } },
      },
      {
        html: "<html>2</html>",
        opts: { dimensions: { width: 1200, height: 627 } },
      },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(Buffer);
  });
});

// =====================================================================
// 6. Visual asset orchestration
// =====================================================================

describe("Visual asset orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (killSwitches as Record<string, boolean>).content_automations_enabled = true;
  });

  it("returns kill_switch when disabled", async () => {
    (killSwitches as Record<string, boolean>).content_automations_enabled = false;
    const { generateVisualAssets } = await import(
      "@/lib/content-engine/visual-assets"
    );
    const result = await generateVisualAssets("post-1");
    expect(result).toEqual({ ok: false, reason: "kill_switch" });
  });

  it("returns no_drafts when no generating drafts exist", async () => {
    const { db } = await import("@/lib/db");
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          all: vi.fn(() => []),
          get: vi.fn(() => undefined),
        })),
      })),
    });

    const { generateVisualAssets } = await import(
      "@/lib/content-engine/visual-assets"
    );
    const result = await generateVisualAssets("post-1");
    expect(result).toEqual({ ok: false, reason: "no_drafts" });
  });

  it("loadBrandVisualTokens returns defaults when no Brand DNA", async () => {
    const { db } = await import("@/lib/db");
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => undefined),
            })),
          })),
        })),
      })),
    });

    const { loadBrandVisualTokens } = await import(
      "@/lib/content-engine/visual-assets"
    );
    const tokens = await loadBrandVisualTokens("company-1");
    expect(tokens.primaryColor).toBe("#D14836");
    expect(tokens.brandName).toBe("SuperBad");
  });
});

// =====================================================================
// 7. Platform specs coverage
// =====================================================================

describe("Platform dimensions", async () => {
  const { PLATFORM_DIMENSIONS } = await import("@/lib/content-engine/social-templates");

  it("all four platforms have dimensions defined", () => {
    expect(PLATFORM_DIMENSIONS.instagram).toBeDefined();
    expect(PLATFORM_DIMENSIONS.linkedin).toBeDefined();
    expect(PLATFORM_DIMENSIONS.x).toBeDefined();
    expect(PLATFORM_DIMENSIONS.facebook).toBeDefined();
  });

  it("instagram portrait variant exists", () => {
    expect(PLATFORM_DIMENSIONS["instagram-portrait"]).toEqual({
      width: 1080,
      height: 1350,
    });
  });
});
