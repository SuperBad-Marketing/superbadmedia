import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => null),
          all: vi.fn(() => []),
        })),
        all: vi.fn(() => []),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => []),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/kill-switches", () => ({
  killSwitches: {
    content_newsletter_enabled: true,
    content_automations_enabled: true,
    scheduled_tasks_enabled: true,
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn(() => ({ sent: true, messageId: "msg_123" })),
}));

vi.mock("@/lib/scheduled-tasks/enqueue", () => ({
  enqueueTask: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import { db } from "@/lib/db";
import {
  handleContentNewsletterSend,
  ensureNewsletterSendEnqueued,
} from "@/lib/scheduled-tasks/handlers/content-newsletter-send";
import {
  resolveReadMoreLinks,
  buildUnsubscribeUrl,
  injectUnsubscribeFooter,
} from "@/lib/content-engine/newsletter-send";

// ── Helpers ─────────────────────────────────────────────────────────

function makeSendRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "send-1",
    company_id: "co-1",
    blog_post_ids: ["post-1"],
    subject: "Test Newsletter",
    body: '<p>Read the post: <a href="{{READ_MORE_LINK}}">here</a></p>',
    format: "single" as const,
    scheduled_for_ms: Date.now() - 60_000,
    sent_at_ms: null,
    recipient_count: null,
    open_count: 0,
    click_count: 0,
    created_at_ms: Date.now() - 3_600_000,
    ...overrides,
  };
}

function makeSubscriber(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    company_id: "co-1",
    email: "reader@example.com",
    name: "Reader",
    consent_source: "blog_cta" as const,
    consented_at_ms: Date.now() - 86_400_000,
    status: "active" as const,
    bounce_count: 0,
    last_opened_at_ms: null,
    unsubscribed_at_ms: null,
    removed_at_ms: null,
    created_at_ms: Date.now() - 86_400_000,
    ...overrides,
  };
}

function makePost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post-1",
    company_id: "co-1",
    topic_id: "topic-1",
    title: "Test Post",
    slug: "test-post",
    body: "Post body here",
    meta_description: "A test post",
    og_image_url: null,
    structured_data: null,
    internal_links: null,
    snippet_target_section: null,
    status: "published" as const,
    published_at_ms: Date.now() - 3_600_000,
    published_url: "https://example.com/blog/test-post",
    created_at_ms: Date.now() - 86_400_000,
    updated_at_ms: Date.now() - 3_600_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (killSwitches as Record<string, boolean>).content_newsletter_enabled = true;
});

// ── Handler tests ───────────────────────────────────────────────────

describe("handleContentNewsletterSend", () => {
  it("exits early when kill switch is off", async () => {
    (killSwitches as Record<string, boolean>).content_newsletter_enabled =
      false;
    await handleContentNewsletterSend();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("processes due sends and self-re-enqueues", async () => {
    const send = makeSendRow();
    const subscriber = makeSubscriber();
    const post = makePost();

    // getDueNewsletterSends → returns [send]
    const mockDbSelect = vi.mocked(db.select);
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => null),
              all: vi.fn(() => {
                selectCallCount++;
                // 1st: getDueNewsletterSends → due sends
                if (selectCallCount === 1) return [send];
                // 2nd: getActiveSubscribers → subscribers
                if (selectCallCount === 2) return [subscriber];
                return [];
              }),
            })),
            all: vi.fn(() => {
              selectCallCount++;
              // 3rd: loadBlogPosts → posts
              if (selectCallCount === 3) return [post];
              return [];
            }),
          })),
        }) as unknown as ReturnType<typeof db.select>,
    );

    await handleContentNewsletterSend();

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_newsletter_send",
      }),
    );
  });

  it("logs and continues when a send throws", async () => {
    const send = makeSendRow();

    const mockDbSelect = vi.mocked(db.select);
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => null),
              all: vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return [send];
                // getActiveSubscribers throws
                if (selectCallCount === 2)
                  throw new Error("DB error");
                return [];
              }),
            })),
            all: vi.fn(() => []),
          })),
        }) as unknown as ReturnType<typeof db.select>,
    );

    await handleContentNewsletterSend();

    // Should still self-perpetuate
    expect(enqueueTask).toHaveBeenCalled();
    // Should log the error
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "content_newsletter_sent",
        body: expect.stringContaining("failed"),
      }),
    );
  });
});

// ── Bootstrap tests ─────────────────────────────────────────────────

describe("ensureNewsletterSendEnqueued", () => {
  it("enqueues with correct task_type and idempotency key", async () => {
    const now = 1700000000000;
    await ensureNewsletterSendEnqueued(now);

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task_type: "content_newsletter_send",
        idempotencyKey: expect.stringContaining("content_newsletter_send:"),
      }),
    );
  });

  it("uses custom initial delay when provided", async () => {
    const now = 1700000000000;
    const delay = 300_000; // 5 min
    await ensureNewsletterSendEnqueued(now, delay);

    expect(enqueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        runAt: now + delay,
      }),
    );
  });
});

// ── Pure function tests ─────────────────────────────────────────────

describe("resolveReadMoreLinks", () => {
  it("replaces single placeholder with published_url", () => {
    const body = 'Read here: <a href="{{READ_MORE_LINK}}">link</a>';
    const posts = [makePost({ published_url: "https://example.com/blog/post" })];
    const result = resolveReadMoreLinks(body, posts);
    expect(result).toBe(
      'Read here: <a href="https://example.com/blog/post">link</a>',
    );
  });

  it("replaces multiple placeholders in order for digest", () => {
    const body =
      "Post 1: {{READ_MORE_LINK}} Post 2: {{READ_MORE_LINK}}";
    const posts = [
      makePost({ id: "p1", published_url: "https://example.com/blog/one" }),
      makePost({ id: "p2", published_url: "https://example.com/blog/two" }),
    ];
    const result = resolveReadMoreLinks(body, posts);
    expect(result).toBe(
      "Post 1: https://example.com/blog/one Post 2: https://example.com/blog/two",
    );
  });

  it("falls back to /blog/<slug> when published_url is null", () => {
    const body = "Read: {{READ_MORE_LINK}}";
    const posts = [
      makePost({ published_url: null, slug: "my-post" }),
    ];
    const result = resolveReadMoreLinks(body, posts);
    expect(result).toBe("Read: /blog/my-post");
  });

  it("replaces excess placeholders with #", () => {
    const body = "{{READ_MORE_LINK}} and {{READ_MORE_LINK}}";
    const posts = [makePost({ published_url: "https://example.com/p1" })];
    const result = resolveReadMoreLinks(body, posts);
    expect(result).toBe("https://example.com/p1 and #");
  });

  it("handles body with no placeholders", () => {
    const body = "No links here";
    const result = resolveReadMoreLinks(body, []);
    expect(result).toBe("No links here");
  });
});

describe("buildUnsubscribeUrl", () => {
  it("builds correct URL with subscriber ID", () => {
    const url = buildUnsubscribeUrl("https://superbadmedia.com.au", "sub-123");
    expect(url).toBe(
      "https://superbadmedia.com.au/api/newsletter/unsubscribe?sid=sub-123",
    );
  });
});

describe("injectUnsubscribeFooter", () => {
  it("injects footer before </body>", () => {
    const body = "<html><body><p>Content</p></body></html>";
    const result = injectUnsubscribeFooter(body, "https://example.com/unsub");
    expect(result).toContain("Unsubscribe");
    expect(result).toContain("https://example.com/unsub");
    expect(result).toContain("</body>");
    // Footer appears before </body>
    const footerIdx = result.indexOf("Unsubscribe");
    const bodyCloseIdx = result.indexOf("</body>");
    expect(footerIdx).toBeLessThan(bodyCloseIdx);
  });

  it("appends footer when no </body> tag", () => {
    const body = "<p>Content</p>";
    const result = injectUnsubscribeFooter(body, "https://example.com/unsub");
    expect(result).toContain("Unsubscribe");
    expect(result).toContain("https://example.com/unsub");
  });

  it("includes correct unsubscribe link in footer", () => {
    const body = "<p>Hello</p></body>";
    const url = "https://example.com/api/newsletter/unsubscribe?sid=abc";
    const result = injectUnsubscribeFooter(body, url);
    expect(result).toContain(`href="${url}"`);
  });
});

// ── sendEmail integration (via mock) ────────────────────────────────

describe("sendEmail headers for newsletter", () => {
  it("passes List-Unsubscribe headers", async () => {
    const send = makeSendRow();
    const subscriber = makeSubscriber();
    const post = makePost();

    // We test the sendNewsletter function directly
    const { sendNewsletter } = await import(
      "@/lib/content-engine/newsletter-send"
    );

    const mockDbSelect = vi.mocked(db.select);
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => null),
              all: vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return [subscriber];
                return [];
              }),
            })),
            all: vi.fn(() => {
              selectCallCount++;
              if (selectCallCount === 2) return [post];
              return [];
            }),
          })),
        }) as unknown as ReturnType<typeof db.select>,
    );

    await sendNewsletter(send);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        classification: "transactional",
        headers: expect.objectContaining({
          "List-Unsubscribe": expect.stringContaining("/api/newsletter/unsubscribe"),
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }),
      }),
    );
  });

  it("counts skipped recipients when sendEmail returns skipped", async () => {
    const send = makeSendRow();
    const sub1 = makeSubscriber({ id: "sub-1", email: "a@example.com" });
    const sub2 = makeSubscriber({ id: "sub-2", email: "b@example.com" });
    const post = makePost();

    const { sendNewsletter } = await import(
      "@/lib/content-engine/newsletter-send"
    );

    vi.mocked(sendEmail)
      .mockResolvedValueOnce({ sent: true, messageId: "msg_1" })
      .mockResolvedValueOnce({ sent: false, skipped: true, reason: "suppressed" });

    const mockDbSelect = vi.mocked(db.select);
    let selectCallCount = 0;
    mockDbSelect.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => null),
              all: vi.fn(() => {
                selectCallCount++;
                if (selectCallCount === 1) return [sub1, sub2];
                return [];
              }),
            })),
            all: vi.fn(() => {
              selectCallCount++;
              if (selectCallCount === 2) return [post];
              return [];
            }),
          })),
        }) as unknown as ReturnType<typeof db.select>,
    );

    const result = await sendNewsletter(send);

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        recipientCount: 1,
        skippedCount: 1,
      }),
    );
  });

  it("returns no_subscribers when company has no active subscribers", async () => {
    const send = makeSendRow();

    const { sendNewsletter } = await import(
      "@/lib/content-engine/newsletter-send"
    );

    const mockDbSelect = vi.mocked(db.select);
    mockDbSelect.mockImplementation(
      () =>
        ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              get: vi.fn(() => null),
              all: vi.fn(() => []),
            })),
            all: vi.fn(() => []),
          })),
        }) as unknown as ReturnType<typeof db.select>,
    );

    const result = await sendNewsletter(send);
    expect(result).toEqual({
      ok: false,
      reason: "no_subscribers",
      sendId: "send-1",
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
