/**
 * UI-8 — ReplyComposer initial-render assertions.
 *
 * Project convention: no jsdom / @testing-library. Tests use
 * `renderToStaticMarkup` and assert against serialised output. Only
 * initial-render state is exercised — effect-driven rehydrate + user
 * events are verified by the manual-browser gate (G10).
 *
 * Covers:
 *  - cached-draft body lands in textarea on first render
 *  - stale banner renders when `cachedDraftStale`
 *  - low-confidence flag panel renders <mark> spans around the span text
 *  - send button is `disabled` when body is empty
 *  - kill-switch tooltip copy on the send button title
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Server actions referenced by the client component — stub so the import
// graph resolves without pulling auth/db/next-cache into the test env.
vi.mock("@/app/lite/inbox/compose/actions", () => ({
  sendCompose: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  saveComposeDraft: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  discardComposeDraft: vi.fn(async () => undefined),
  refineDraft: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  pollCachedDraft: vi.fn(async () => ({
    ok: true,
    body: null,
    stale: false,
    flags: [],
  })),
  regenerateCachedDraft: vi.fn(async () => ({ ok: true, enqueued: true })),
}));

vi.mock("@/app/lite/inbox/ticket/actions", () => ({
  setTicketTypeAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  setTicketStatusAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  closeTicketAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  respondToCalendarInviteAction: vi.fn(async () => ({
    ok: false,
    error: "test-stub",
  })),
}));

const { ReplyComposer } = await import(
  "@/app/lite/inbox/_components/reply-composer"
);

const baseProps = {
  threadId: "t1",
  contactId: "c1",
  companyId: "co1",
  toAddresses: ["sam@acme.test"],
  sendingAddress: "andy@",
  subject: "Subject",
  cachedDraftBody: null,
  cachedDraftStale: false,
  lowConfidenceFlags: [],
  sendEnabled: true,
  llmEnabled: true,
};

describe("<ReplyComposer> initial render", () => {
  it("pre-loads the cached draft body into the textarea", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        {...baseProps}
        cachedDraftBody="Hi Sam — sounds good, let's lock it in."
      />,
    );
    expect(html).toContain("Hi Sam — sounds good, let&#x27;s lock it in.");
  });

  it("renders the stale banner only when cachedDraftStale is true", () => {
    const fresh = renderToStaticMarkup(
      <ReplyComposer
        {...baseProps}
        cachedDraftBody="Hey."
        cachedDraftStale={false}
      />,
    );
    expect(fresh).not.toContain("New message arrived — regenerate draft?");

    const stale = renderToStaticMarkup(
      <ReplyComposer
        {...baseProps}
        cachedDraftBody="Hey."
        cachedDraftStale={true}
      />,
    );
    expect(stale).toContain("New message arrived — regenerate draft?");
  });

  it("wraps flagged spans in <mark> highlights over the cached body", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        {...baseProps}
        cachedDraftBody="Happy to send the deck by Friday."
        lowConfidenceFlags={[
          { span: "by Friday", reason: "No commitment found in thread" },
        ]}
      />,
    );
    expect(html).toContain("<mark");
    expect(html).toContain("by Friday");
    expect(html).toContain("No commitment found in thread");
  });

  it("disables the Send button when the body is empty", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer {...baseProps} cachedDraftBody={null} />,
    );
    // The send button carries both the Send icon and the word "Send"; the
    // disabled attribute should appear on the same button. Match the send
    // button segment by the "Send reply" title / Send text boundary.
    expect(html).toMatch(/disabled[^>]*>\s*<svg[^>]*>.*?<\/svg>\s*Send/);
  });

  it("surfaces the kill-switch copy on the Send button title when sending is off", () => {
    const html = renderToStaticMarkup(
      <ReplyComposer
        {...baseProps}
        cachedDraftBody="Ready to go."
        sendEnabled={false}
      />,
    );
    expect(html).toContain("Sending&#x27;s paused — try again in a minute.");
  });
});
