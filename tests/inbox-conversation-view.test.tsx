/**
 * UI-9 — <ConversationView> initial-render assertions.
 *
 * Project convention: no jsdom / @testing-library. Uses
 * `renderToStaticMarkup` + mocked data. Only initial-render state is
 * exercised — collapse-toggle interactions are covered by the
 * manual-browser gate (G10).
 *
 * Covers:
 *  - empty-contact voice copy ("First time you've spoken")
 *  - Back link href points at the return thread
 *  - per-thread Open link href carries view/address/sort + thread id
 *  - unread thread expanded by default (messages in markup)
 *  - all-read contact shows the "All caught up" footer text
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { ConversationPayload } from "@/app/lite/inbox/_queries/list-conversation";

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

const { ConversationView } = await import(
  "@/app/lite/inbox/_components/conversation-view"
);

const NOW = 1_700_000_000_000;

function contact(
  overrides: Partial<ConversationPayload["contact"]> = {},
): ConversationPayload["contact"] {
  return {
    id: "contact-1",
    company_id: "company-1",
    name: "Sam Ryder",
    role: null,
    email: "sam@acme.test",
    email_normalised: "sam@acme.test",
    email_status: "valid",
    phone: null,
    phone_normalised: null,
    is_primary: false,
    notes: null,
    stripe_customer_id: null,
    relationship_type: "client",
    onboarding_welcome_seen_at_ms: null,
    inbox_alt_emails: [],
    notification_weight: 0,
    always_keep_noise: false,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    ...overrides,
  };
}

function company(
  overrides: Partial<NonNullable<ConversationPayload["company"]>> = {},
): NonNullable<ConversationPayload["company"]> {
  return {
    id: "company-1",
    name: "Acme",
    name_normalised: "acme",
    domain: null,
    industry: null,
    size_band: null,
    billing_mode: "stripe",
    do_not_contact: false,
    notes: null,
    trial_shoot_status: "none",
    trial_shoot_completed_at_ms: null,
    trial_shoot_plan: null,
    trial_shoot_feedback: null,
    shape: null,
    gst_applicable: true,
    abn: null,
    payment_terms_days: 14,
    revenue_range: null,
    team_size: null,
    biggest_constraint: null,
    twelve_month_goal: null,
    industry_vertical: null,
    industry_vertical_other: null,
    location: null,
    revenue_segmentation_completed_at_ms: null,
    first_seen_at_ms: NOW,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    ...overrides,
  };
}

function thread(
  overrides: Partial<ConversationPayload["threads"][number]["thread"]> = {},
): ConversationPayload["threads"][number]["thread"] {
  return {
    id: "thread-1",
    contact_id: "contact-1",
    company_id: "company-1",
    channel_of_origin: "email",
    sending_address: "andy@",
    subject: "Lock it in",
    ticket_status: null,
    ticket_type: null,
    ticket_type_assigned_by: null,
    ticket_resolved_at_ms: null,
    priority_class: "signal",
    keep_until_ms: null,
    keep_pinned: false,
    last_message_at_ms: NOW + 1000,
    last_inbound_at_ms: null,
    last_outbound_at_ms: NOW + 1000,
    has_cached_draft: false,
    cached_draft_body: null,
    cached_draft_generated_at_ms: null,
    cached_draft_stale: false,
    cached_draft_low_confidence_flags: null,
    snoozed_until_ms: null,
    created_at_ms: NOW,
    updated_at_ms: NOW + 1000,
    ...overrides,
  };
}

function message(
  overrides: Partial<ConversationPayload["threads"][number]["messages"][number]> = {},
): ConversationPayload["threads"][number]["messages"][number] {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    direction: "inbound",
    channel: "email",
    from_address: "sam@acme.test",
    to_addresses: ["andy@superbadmedia.com.au"],
    cc_addresses: null,
    bcc_addresses: null,
    subject: "Lock it in",
    body_text: "Sounds great to me.",
    body_html: null,
    headers: null,
    message_id_header: null,
    in_reply_to_header: null,
    references_header: null,
    sent_at_ms: NOW,
    received_at_ms: NOW,
    priority_class: "signal",
    noise_subclass: null,
    notification_priority: null,
    router_classification: null,
    router_reason: null,
    is_engaged: false,
    engagement_signals: null,
    import_source: "live",
    has_attachments: false,
    has_calendar_invite: false,
    graph_message_id: null,
    keep_until_ms: null,
    deleted_at_ms: null,
    created_at_ms: NOW,
    updated_at_ms: NOW,
    ...overrides,
  };
}

describe("<ConversationView> initial render", () => {
  it("renders the voice-treated empty state when the contact has no threads", () => {
    const data: ConversationPayload = {
      contact: contact(),
      company: company(),
      threads: [],
    };

    const html = renderToStaticMarkup(
      <ConversationView
        data={data}
        view="focus"
        address="all"
        sort="recent"
        returnThreadId={null}
      />,
    );

    expect(html).toContain("First time you");
    expect(html).toContain("Nothing to look back on yet.");
  });

  it("builds a Back link that returns to the prior thread", () => {
    const data: ConversationPayload = {
      contact: contact(),
      company: company(),
      threads: [],
    };

    const html = renderToStaticMarkup(
      <ConversationView
        data={data}
        view="focus"
        address="andy@"
        sort="recent"
        returnThreadId="thread-abc"
      />,
    );

    expect(html).toContain(
      'href="/lite/inbox?view=focus&amp;address=andy%40&amp;thread=thread-abc"',
    );
  });

  it("expands unread threads by default and renders per-thread Open links", () => {
    const unreadThread = thread({
      id: "thread-unread",
      subject: "Waiting on you",
      last_inbound_at_ms: NOW + 5000,
      last_outbound_at_ms: NOW + 1000,
      last_message_at_ms: NOW + 5000,
    });

    const data: ConversationPayload = {
      contact: contact(),
      company: company(),
      threads: [
        {
          thread: unreadThread,
          messages: [
            message({
              id: "msg-inbound",
              thread_id: "thread-unread",
              direction: "inbound",
              body_text: "Still waiting on the brief.",
              created_at_ms: NOW + 5000,
            }),
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ConversationView
        data={data}
        view="focus"
        address="all"
        sort="recent"
        returnThreadId="thread-return"
      />,
    );

    expect(html).toContain("Waiting on you");
    expect(html).toContain("Still waiting on the brief.");
    expect(html).toContain(
      'href="/lite/inbox?view=focus&amp;thread=thread-unread"',
    );
    expect(html).toContain('aria-expanded="true"');
  });

  it("collapses fully-read threads and shows the All-caught-up note", () => {
    const readThread = thread({
      id: "thread-read",
      subject: "Older and done",
      last_inbound_at_ms: NOW + 500,
      last_outbound_at_ms: NOW + 1000,
      last_message_at_ms: NOW + 1000,
    });

    const data: ConversationPayload = {
      contact: contact(),
      company: company(),
      threads: [
        {
          thread: readThread,
          messages: [
            message({
              id: "msg-read",
              thread_id: "thread-read",
              body_text: "This should be hidden when collapsed.",
              created_at_ms: NOW + 1000,
            }),
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      <ConversationView
        data={data}
        view="focus"
        address="all"
        sort="recent"
        returnThreadId={null}
      />,
    );

    expect(html).toContain("All caught up");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("This should be hidden when collapsed.");
  });
});
