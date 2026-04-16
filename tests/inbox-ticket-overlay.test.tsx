/**
 * UI-10 — <TicketOverlay> initial-render assertions.
 *
 * Project convention: no jsdom / @testing-library. Uses
 * `renderToStaticMarkup` + mocked server actions. Only initial-render
 * state is exercised — dropdown-open interactions + optimistic rollback
 * are covered by the manual-browser gate (G10).
 *
 * Covers per brief §5:
 *  - Type chip renders "Classifying…" placeholder when ticketType is null
 *  - Type chip renders Claude's selection with Sparkles icon
 *  - Type chip suppresses Sparkles when assignedBy === "andy"
 *  - Status pill renders the current status label
 *  - Both dropdowns start closed (aria-expanded="false")
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Server actions referenced by the client component — stub so the import
// graph resolves without pulling auth/db/next-cache into the test env.
vi.mock("@/app/lite/inbox/ticket/actions", () => ({
  setTicketTypeAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  setTicketStatusAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  closeTicketAction: vi.fn(async () => ({ ok: false, error: "test-stub" })),
  respondToCalendarInviteAction: vi.fn(async () => ({
    ok: false,
    error: "test-stub",
  })),
}));

const { TicketOverlay } = await import(
  "@/app/lite/inbox/_components/ticket-overlay"
);

describe("<TicketOverlay> initial render", () => {
  it("shows the 'Classifying…' placeholder when no type is assigned yet", () => {
    const html = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType={null}
        ticketStatus="open"
        ticketTypeAssignedBy={null}
      />,
    );
    expect(html).toContain("Classifying");
    expect(html).toContain("Ticket");
  });

  it("renders the Claude-picked type with the Sparkles cue", () => {
    const html = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType="billing"
        ticketStatus="open"
        ticketTypeAssignedBy="claude"
      />,
    );
    expect(html).toContain("Billing");
    // Sparkles icon renders an <svg> from lucide-react — the
    // `lucide-sparkles` class is the reliable marker.
    expect(html).toContain("lucide-sparkles");
  });

  it("does NOT render the Sparkles cue once Andy has overridden the type", () => {
    const html = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType="bug"
        ticketStatus="open"
        ticketTypeAssignedBy="andy"
      />,
    );
    expect(html).toContain("Bug");
    expect(html).not.toContain("lucide-sparkles");
  });

  it("renders the status pill with the current status label", () => {
    const waiting = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType="question"
        ticketStatus="waiting_on_customer"
        ticketTypeAssignedBy="claude"
      />,
    );
    expect(waiting).toContain("Waiting on customer");

    const resolved = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType="question"
        ticketStatus="resolved"
        ticketTypeAssignedBy="claude"
      />,
    );
    expect(resolved).toContain("Resolved");
  });

  it("renders both dropdowns collapsed by default (§16 #60 — no composer unmount on toggle)", () => {
    const html = renderToStaticMarkup(
      <TicketOverlay
        threadId="thread-1"
        ticketType="billing"
        ticketStatus="open"
        ticketTypeAssignedBy="claude"
      />,
    );
    // Two buttons (type chip + status pill) — both must start closed so
    // nothing in the overlay can re-render the surrounding ReplyComposer
    // on first paint.
    const expandedMatches = html.match(/aria-expanded="false"/g) ?? [];
    expect(expandedMatches.length).toBe(2);
    expect(html).not.toContain('aria-expanded="true"');
    // The options lists are gated by AnimatePresence + `open` state, so
    // their contents should not appear until the user opens them.
    expect(html).not.toContain("Doesn&#x27;t fit the buckets");
  });
});
