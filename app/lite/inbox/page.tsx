/**
 * /lite/inbox — three-column desktop inbox (UI-8).
 *
 * Spec: docs/specs/unified-inbox.md §§4.1 + 4.4 + 4.6 + 7.4. Brief:
 * sessions/ui-8-brief.md. Admin-only; non-admins redirect to sign-in.
 *
 * URL shape: `/lite/inbox?view=focus&address=all&thread=<id>&sort=recent`.
 * View / address / sort drive the middle list; `thread` selects the
 * right-column detail. Navigation is server-driven — each click is a
 * new request that renders the new detail panel.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { killSwitches } from "@/lib/kill-switches";
import {
  INBOX_ADDRESS_FILTERS,
  INBOX_SORT_ORDERS,
  INBOX_VIEWS,
  listThreads,
  type InboxAddressFilter,
  type InboxSortOrder,
  type InboxView,
} from "./_queries/list-threads";
import { readThread } from "./_queries/read-thread";
import { listConversation } from "./_queries/list-conversation";
import { loadSupportCustomerContext } from "./_queries/load-support-customer-context";
import { InboxShell } from "./_components/inbox-shell";
import {
  ThreadDetail,
  ThreadDetailEmpty,
} from "./_components/thread-detail";
import {
  ConversationView,
  ConversationViewUnknownContact,
} from "./_components/conversation-view";
import { MobileThreadDetail } from "./_components/mobile-thread-detail";

export const metadata: Metadata = {
  title: "SuperBad — Inbox",
  robots: { index: false, follow: false },
};

function parseView(raw: string | undefined): InboxView {
  if (raw && (INBOX_VIEWS as readonly string[]).includes(raw)) {
    return raw as InboxView;
  }
  return "focus";
}

function parseAddress(raw: string | undefined): InboxAddressFilter {
  if (raw && (INBOX_ADDRESS_FILTERS as readonly string[]).includes(raw)) {
    return raw as InboxAddressFilter;
  }
  return "all";
}

function parseSort(raw: string | undefined): InboxSortOrder {
  if (raw && (INBOX_SORT_ORDERS as readonly string[]).includes(raw)) {
    return raw as InboxSortOrder;
  }
  return "recent";
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    address?: string;
    sort?: string;
    thread?: string;
    draft?: string;
    conversationWith?: string;
    tab?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const sp = await searchParams;
  const view = parseView(sp.view);
  const address = parseAddress(sp.address);
  const sort = parseSort(sp.sort);
  const selectedThreadId = sp.thread ?? null;
  const selectedDraftId = sp.draft ?? null;
  const conversationContactId = sp.conversationWith ?? null;
  const mobileTab = sp.tab ?? null;

  const listResult = await listThreads({
    view,
    addressFilter: address,
    sort,
    adminUserId: session.user.id,
  });

  const detail = selectedThreadId
    ? await readThread(selectedThreadId)
    : null;

  const conversation = conversationContactId
    ? await listConversation(conversationContactId)
    : null;

  const conversationActive = conversationContactId !== null;

  const customerContext =
    detail &&
    detail.thread.sending_address === "support@" &&
    detail.thread.contact_id
      ? await loadSupportCustomerContext(detail.thread.contact_id)
      : null;

  const sendEnabled = killSwitches.inbox_send_enabled;
  const llmEnabled = killSwitches.llm_calls_enabled;
  const now = Date.now();

  const threadDetailNode = detail ? (
    <ThreadDetail
      thread={detail.thread}
      messages={detail.messages}
      contact={detail.contact}
      company={detail.company}
      customerContext={customerContext}
      sendEnabled={sendEnabled}
      llmEnabled={llmEnabled}
      view={view}
      address={address}
      sort={sort}
    />
  ) : (
    <ThreadDetailEmpty />
  );

  const mobileDetailNode = detail ? (
    <MobileThreadDetail
      thread={detail.thread}
      messages={detail.messages}
      contact={detail.contact}
      company={detail.company}
      customerContext={customerContext}
      sendEnabled={sendEnabled}
      llmEnabled={llmEnabled}
      view={view}
      address={address}
      sort={sort}
      tab={mobileTab ?? "focus"}
    />
  ) : null;

  const conversationNode = conversationActive ? (
    conversation ? (
      <ConversationView
        data={conversation}
        view={view}
        address={address}
        sort={sort}
        returnThreadId={selectedThreadId}
      />
    ) : (
      <ConversationViewUnknownContact />
    )
  ) : null;

  const detailSlot = (
    <>
      <div className={conversationActive ? "hidden" : "h-full"}>
        {threadDetailNode}
      </div>
      {conversationNode && (
        <div className={conversationActive ? "h-full" : "hidden"}>
          {conversationNode}
        </div>
      )}
    </>
  );

  return (
    <InboxShell
      view={view}
      address={address}
      sort={sort}
      selectedThreadId={selectedThreadId}
      selectedDraftId={selectedDraftId}
      rows={listResult.rows}
      hasMore={listResult.hasMore}
      now={now}
      sendEnabled={sendEnabled}
      llmEnabled={llmEnabled}
      detail={detailSlot}
      mobileDetail={mobileDetailNode}
      mobileTab={mobileTab}
    />
  );
}
