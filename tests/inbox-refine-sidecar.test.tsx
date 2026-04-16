/**
 * UI-8 — RefineSidecar initial-render assertions.
 *
 * Same constraint as `inbox-reply-composer.test.tsx`: no jsdom, so we
 * assert against static markup of the initial render. Interactive
 * behaviour (Re-draft appends a turn, preserve-prior on fallback) is
 * covered at the action/library layer in `tests/graph-refine-draft.test.ts`
 * and via the manual-browser gate.
 *
 * Covers:
 *  - dialog chrome + Refine header copy
 *  - prior draft renders inside the "Current draft" panel
 *  - textarea is disabled when `llmEnabled={false}` + kill-switch title
 *  - turn counter shows `0/MAX_REFINE_TURNS · 0/MAX_REFINE_INSTRUCTION_CHARS`
 *  - "Use this" button is disabled before any refine has happened
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/lite/inbox/compose/actions", () => ({
  refineDraft: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  sendCompose: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  saveComposeDraft: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  discardComposeDraft: vi.fn(async () => undefined),
}));

const { RefineSidecar } = await import(
  "@/app/lite/inbox/_components/refine-sidecar"
);
const { MAX_REFINE_INSTRUCTION_CHARS, MAX_REFINE_TURNS } = await import(
  "@/lib/graph/refine-draft"
);

const baseProps = {
  priorDraft: "Happy to send the deck over on Friday.",
  contactId: "c1",
  threadId: "t1",
  sendingAddress: "andy@",
  llmEnabled: true,
  onAccept: () => {},
  onClose: () => {},
};

describe("<RefineSidecar> initial render", () => {
  it("renders the dialog chrome with Refine header + close control", () => {
    const html = renderToStaticMarkup(<RefineSidecar {...baseProps} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="Refine draft"');
    expect(html).toContain("Sharpen the draft");
    expect(html).toContain('aria-label="Close refine"');
  });

  it("renders the prior draft inside the current-draft panel", () => {
    const html = renderToStaticMarkup(<RefineSidecar {...baseProps} />);
    expect(html).toContain("Current draft");
    expect(html).toContain("Happy to send the deck over on Friday.");
  });

  it("disables the instruction textarea when llmEnabled is false", () => {
    const html = renderToStaticMarkup(
      <RefineSidecar {...baseProps} llmEnabled={false} />,
    );
    // The textarea carries aria-label "What should change"; the same tag
    // should also have `disabled`.
    expect(html).toMatch(/<textarea[^>]*aria-label="What should change"[^>]*disabled/);
    // Re-draft button surfaces the kill-switch copy as title.
    expect(html).toContain("Refine&#x27;s paused — LLM calls off.");
  });

  it("shows the starting counters against the refine caps", () => {
    const html = renderToStaticMarkup(<RefineSidecar {...baseProps} />);
    expect(html).toContain(`0/${MAX_REFINE_TURNS} turns`);
    expect(html).toContain(`0/${MAX_REFINE_INSTRUCTION_CHARS}`);
  });

  it("disables the 'Use this' button until a refine has landed", () => {
    const html = renderToStaticMarkup(<RefineSidecar {...baseProps} />);
    // The "Use this" button should appear with `disabled` — there's been
    // zero turns and the latest body still equals the prior draft.
    expect(html).toMatch(/disabled[^>]*>\s*<svg[^>]*>.*?<\/svg>\s*Use this/);
  });
});
