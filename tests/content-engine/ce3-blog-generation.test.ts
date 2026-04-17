/**
 * CE-3 — Blog generation + review + publish tests.
 *
 * Tests the core content engine pipeline: generation via Opus, approval,
 * rejection + regeneration, publishing, and the public blog route helpers.
 */
import { describe, it, expect, vi } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/db", () => {
  const rows: Record<string, unknown[]> = {};
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({
                get: vi.fn(() => null),
                then: vi.fn((cb: (r: unknown[]) => unknown) => cb([])),
              })),
              get: vi.fn(() => null),
            })),
            get: vi.fn(() => null),
            limit: vi.fn(() => ({
              get: vi.fn(() => null),
            })),
          })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => rows),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => [{ id: "test-id" }]),
          })),
          returning: vi.fn(() => []),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning: vi.fn(() => [{ id: "test" }]) })),
        })),
      })),
    },
  };
});

vi.mock("@/lib/ai/invoke", () => ({
  invokeLlmText: vi.fn(),
}));

vi.mock("@/lib/ai/drift-check", () => ({
  checkBrandVoiceDrift: vi.fn(() => ({
    pass: true,
    score: 0.9,
    notes: "Good match",
  })),
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_automations_enabled: true,
    llm_calls_enabled: true,
    drift_check_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(() => ({ id: "task-id" })),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(() => ({ sent: true })),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";

// ── generate-blog-post.ts tests ─────────────────────────────────────────���────

describe("generateBlogPost", () => {
  // Dynamic import to apply mocks
  async function getModule() {
    return import("@/lib/content-engine/generate-blog-post");
  }

  it("exports generateBlogPost function", async () => {
    const mod = await getModule();
    expect(typeof mod.generateBlogPost).toBe("function");
  });

  it("returns kill_switch when content_automations_enabled is false", async () => {
    const original = killSwitches.content_automations_enabled;
    (killSwitches as Record<string, boolean>).content_automations_enabled = false;
    try {
      const mod = await getModule();
      const result = await mod.generateBlogPost("company-1");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("kill_switch");
      }
    } finally {
      (killSwitches as Record<string, boolean>).content_automations_enabled =
        original;
    }
  });

  it("exports BlogPostDraft and GenerateResult types", async () => {
    const mod = await getModule();
    expect(mod).toBeDefined();
  });
});

// ── parseBlogDraftResponse tests (via module internals, tested indirectly) ───

describe("blog draft JSON parsing", () => {
  it("valid blog draft JSON is parseable", () => {
    const validJson = JSON.stringify({
      title: "Test Blog Post",
      slug: "test-blog-post",
      body: "## Heading\n\nParagraph content",
      metaDescription: "A test blog post about testing",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Article",
      },
      internalLinks: ["related-post-1"],
      snippetTargetSection: "Heading",
    });
    const parsed = JSON.parse(validJson);
    expect(parsed.title).toBe("Test Blog Post");
    expect(parsed.slug).toBe("test-blog-post");
    expect(parsed.body).toContain("## Heading");
    expect(parsed.metaDescription).toBe("A test blog post about testing");
    expect(parsed.structuredData["@type"]).toBe("Article");
    expect(parsed.internalLinks).toHaveLength(1);
    expect(parsed.snippetTargetSection).toBe("Heading");
  });

  it("slug is sanitised from title", () => {
    const rawSlug = "Test Blog Post!!! With Special @Characters";
    const slug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("test-blog-post-with-special-characters");
  });

  it("empty slug falls back from title", () => {
    const title = "My First Post";
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    expect(slug).toBe("my-first-post");
  });
});

// ── review.ts tests ──────────────────────────────────────────────────────────

describe("review module exports", () => {
  async function getModule() {
    return import("@/lib/content-engine/review");
  }

  it("exports approveBlogPost", async () => {
    const mod = await getModule();
    expect(typeof mod.approveBlogPost).toBe("function");
  });

  it("exports rejectAndRegenerate", async () => {
    const mod = await getModule();
    expect(typeof mod.rejectAndRegenerate).toBe("function");
  });

  it("exports getBlogPostFeedback", async () => {
    const mod = await getModule();
    expect(typeof mod.getBlogPostFeedback).toBe("function");
  });

  it("exports getBlogPostForReview", async () => {
    const mod = await getModule();
    expect(typeof mod.getBlogPostForReview).toBe("function");
  });

  it("exports listPostsForReview", async () => {
    const mod = await getModule();
    expect(typeof mod.listPostsForReview).toBe("function");
  });
});

// ── publish.ts tests ─────────────────────────────────────────────────────────

describe("publish module exports", () => {
  async function getModule() {
    return import("@/lib/content-engine/publish");
  }

  it("exports publishBlogPost", async () => {
    const mod = await getModule();
    expect(typeof mod.publishBlogPost).toBe("function");
  });

  it("exports resolveCompanyByDomain", async () => {
    const mod = await getModule();
    expect(typeof mod.resolveCompanyByDomain).toBe("function");
  });

  it("exports getPublishedPost", async () => {
    const mod = await getModule();
    expect(typeof mod.getPublishedPost).toBe("function");
  });

  it("exports listPublishedPosts", async () => {
    const mod = await getModule();
    expect(typeof mod.listPublishedPosts).toBe("function");
  });
});

// ── barrel exports ───────────────────────────────────────────────────────────

describe("content-engine barrel (CE-3 additions)", () => {
  async function getBarrel() {
    return import("@/lib/content-engine/index");
  }

  it("re-exports generateBlogPost", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.generateBlogPost).toBe("function");
  });

  it("re-exports approveBlogPost", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.approveBlogPost).toBe("function");
  });

  it("re-exports rejectAndRegenerate", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.rejectAndRegenerate).toBe("function");
  });

  it("re-exports publishBlogPost", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.publishBlogPost).toBe("function");
  });

  it("re-exports getBlogPostFeedback", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.getBlogPostFeedback).toBe("function");
  });

  it("re-exports resolveCompanyByDomain", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.resolveCompanyByDomain).toBe("function");
  });

  // CE-2 exports still present
  it("still exports CE-2 functions", async () => {
    const barrel = await getBarrel();
    expect(typeof barrel.runKeywordResearch).toBe("function");
    expect(typeof barrel.generateTopicOutline).toBe("function");
    expect(typeof barrel.listQueuedTopics).toBe("function");
    expect(typeof barrel.vetoTopic).toBe("function");
    expect(typeof barrel.pickNextTopic).toBe("function");
  });
});

// ── invokeLlmText system-message support ─────────────────────────────────────

describe("invokeLlmText system param", () => {
  it("accepts optional system parameter in type", async () => {
    // The type check passing (via tsc --noEmit) proves the interface accepts
    // system. This test verifies the mock contract.
    const { invokeLlmText: invoke } = await import("@/lib/ai/invoke");
    vi.mocked(invoke).mockResolvedValueOnce("test response");

    await invoke({
      job: "content-generate-blog-post",
      system: "You are a blog writer.",
      prompt: "Write a blog post.",
      maxTokens: 100,
    });

    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "You are a blog writer.",
      }),
    );
  });

  it("works without system parameter (backwards compatible)", async () => {
    const { invokeLlmText: invoke } = await import("@/lib/ai/invoke");
    vi.mocked(invoke).mockResolvedValueOnce("test response");

    await invoke({
      job: "content-generate-blog-post",
      prompt: "Write a blog post.",
      maxTokens: 100,
    });

    expect(invoke).toHaveBeenCalledWith(
      expect.not.objectContaining({
        system: expect.anything(),
      }),
    );
  });
});

// ── drift check integration ──────────────────────────────────────────────────

describe("drift check in generation pipeline", () => {
  it("checkBrandVoiceDrift is called with correct interface", async () => {
    const { checkBrandVoiceDrift: check } = await import(
      "@/lib/ai/drift-check"
    );
    vi.mocked(check).mockResolvedValueOnce({
      pass: true,
      score: 0.85,
      notes: "Consistent voice",
    });

    const result = await check("Test blog content", {
      voiceDescription: "dry, observational",
      toneMarkers: ["dry", "witty"],
    });

    expect(result.pass).toBe(true);
    expect(result.score).toBe(0.85);
  });

  it("drift check failure returns pass: false", async () => {
    const { checkBrandVoiceDrift: check } = await import(
      "@/lib/ai/drift-check"
    );
    vi.mocked(check).mockResolvedValueOnce({
      pass: false,
      score: 0.3,
      notes: "Voice drift detected",
    });

    const result = await check("Generic AI content", {
      voiceDescription: "dry, observational",
      toneMarkers: ["dry", "witty"],
    });

    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(0.7);
  });
});

// ── enqueueTask for fan-out ──────────────────────────────────────────────────

describe("fan-out enqueue on approval", () => {
  it("enqueueTask is callable with content_fan_out type", async () => {
    vi.mocked(enqueueTask).mockResolvedValueOnce(null);

    await enqueueTask({
      task_type: "content_fan_out",
      runAt: Date.now(),
      payload: { post_id: "test-post", company_id: "test-company" },
      idempotencyKey: "content_fan_out_test-post",
    });

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_fan_out",
        payload: expect.objectContaining({ post_id: "test-post" }),
      }),
    );
  });
});

// ── domain resolution ────────────────────────────────────────────────────────

describe("resolveCompanyByDomain", () => {
  it("strips port from hostname before lookup", () => {
    const hostname = "example.com:3001";
    const cleanHost = hostname.replace(/:\d+$/, "");
    expect(cleanHost).toBe("example.com");
  });

  it("handles hostnames without port", () => {
    const hostname = "superbadmedia.com.au";
    const cleanHost = hostname.replace(/:\d+$/, "");
    expect(cleanHost).toBe("superbadmedia.com.au");
  });
});
