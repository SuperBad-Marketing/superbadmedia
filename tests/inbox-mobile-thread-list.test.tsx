/**
 * UI-11 — <MobileThreadList> initial-render + swipe-action assertions.
 *
 * Project convention: no jsdom / @testing-library. Uses
 * `renderToStaticMarkup` for structure + mocked server actions. Swipe
 * gesture mechanics are covered by the manual-browser gate (G10).
 *
 * Covers per brief §5:
 *  - Row renders sender, snippet, and timestamp
 *  - Each row links to the correct thread URL
 *  - Empty state renders the provided copy
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("framer-motion", () => {
  const actual: Record<string, unknown> = {};
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          const Comp = React.forwardRef(
            function MotionMock(props: Record<string, unknown>, ref: React.Ref<unknown>) {
              const {
                initial: _i,
                animate: _a,
                exit: _e,
                transition: _t,
                layout: _l,
                drag: _d,
                dragElastic: _de,
                dragConstraints: _dc,
                onDragEnd: _od,
                whileTap: _wt,
                whileHover: _wh,
                ...rest
              } = props;
              return React.createElement(prop, { ...rest, ref });
            },
          );
          Comp.displayName = `motion.${prop}`;
          return Comp;
        },
      },
    ),
    useMotionValue: (init: number) => ({
      get: () => init,
      set: () => {},
      on: () => () => {},
    }),
    useTransform: () => ({
      get: () => 0,
      set: () => {},
      on: () => () => {},
    }),
    useReducedMotion: () => false,
  };
});

vi.mock("@/app/lite/inbox/thread/actions", () => ({
  setThreadKeepAction: vi.fn(async () => ({ ok: true })),
  archiveThreadAction: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/offline/inbox-cache", () => ({
  queueAction: vi.fn(async () => {}),
  newActionId: () => "test-action-id",
}));

const { MobileThreadList } = await import(
  "@/app/lite/inbox/_components/mobile-thread-list"
);

const NOW = 1713200000000;

function makeRow(overrides: Partial<{
  id: string;
  kind: "thread" | "draft";
  threadId: string;
  senderLabel: string;
  subject: string | null;
  previewText: string | null;
  lastMessageAtMs: number;
  isUnread: boolean;
  keepPinned: boolean;
}> = {}) {
  return {
    id: overrides.id ?? "thread_t1",
    kind: (overrides.kind ?? "thread") as "thread",
    threadId: overrides.threadId ?? "t1",
    senderLabel: overrides.senderLabel ?? "Jane Doe",
    subject: overrides.subject ?? "Hello there",
    previewText: overrides.previewText ?? "Quick question about the shoot",
    lastMessageAtMs: overrides.lastMessageAtMs ?? NOW - 3_600_000,
    isUnread: overrides.isUnread ?? true,
    keepPinned: overrides.keepPinned ?? false,
    sendingAddress: "andy@",
    priorityClass: "signal" as const,
    contactName: "Jane Doe",
    companyName: null,
    channel: "email",
    notificationPriority: null,
    lowConfidenceFlagCount: 0,
    hasCachedDraft: false,
    cachedDraftStale: false,
    snoozedUntilMs: null,
  };
}

describe("<MobileThreadList> initial render", () => {
  it("renders a row with sender, snippet, and timestamp", () => {
    const html = renderToStaticMarkup(
      <MobileThreadList
        rows={[makeRow()]}
        view="focus"
        address="all"
        sort="recent"
        now={NOW}
        emptyCopy={{ title: "Nothing waiting." }}
      />,
    );
    expect(html).toContain("Jane Doe");
    expect(html).toContain("Hello there");
    expect(html).toContain("1h");
  });

  it("links each row to the correct thread URL", () => {
    const html = renderToStaticMarkup(
      <MobileThreadList
        rows={[makeRow({ threadId: "abc123" })]}
        view="focus"
        address="all"
        sort="recent"
        now={NOW}
        emptyCopy={{ title: "Nothing waiting." }}
      />,
    );
    expect(html).toContain("thread=abc123");
    expect(html).toContain("/lite/inbox");
  });

  it("renders the empty-state copy when there are no rows", () => {
    const html = renderToStaticMarkup(
      <MobileThreadList
        rows={[]}
        view="focus"
        address="all"
        sort="recent"
        now={NOW}
        emptyCopy={{ title: "Nothing waiting.", body: "You're good." }}
      />,
    );
    expect(html).toContain("Nothing waiting.");
    expect(html).toContain("You&#x27;re good.");
  });
});
