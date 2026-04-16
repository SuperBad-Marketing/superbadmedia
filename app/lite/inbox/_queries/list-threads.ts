import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { threads, messages } from "@/lib/db/schema/messages";
import { compose_drafts } from "@/lib/db/schema/compose-drafts";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";

/**
 * Spec §4.1 left-nav views. The middle column is the same component
 * across all ten — only the filter branch differs, which is why every
 * filter lives here and not in the page.
 *
 * Drafts view is special: it reads `compose_drafts` rows (Andy's WIP),
 * not thread rows. The list component handles both via a `kind`
 * discriminator so we don't fork the row renderer.
 */
export const INBOX_VIEWS = [
  "focus",
  "all",
  "noise",
  "support",
  "drafts",
  "sent",
  "snoozed",
  "trash",
  "spam",
] as const;
export type InboxView = (typeof INBOX_VIEWS)[number];

export const INBOX_ADDRESS_FILTERS = ["all", "andy@", "support@"] as const;
export type InboxAddressFilter = (typeof INBOX_ADDRESS_FILTERS)[number];

export const INBOX_SORT_ORDERS = ["recent", "unread_first", "priority_first"] as const;
export type InboxSortOrder = (typeof INBOX_SORT_ORDERS)[number];

export const THREAD_LIST_PAGE_SIZE = 50;

export type ThreadListRow = {
  kind: "thread";
  id: string;
  threadId: string;
  subject: string | null;
  previewText: string;
  senderLabel: string;
  contactName: string | null;
  companyName: string | null;
  channel: string;
  priorityClass: "signal" | "noise" | "spam";
  notificationPriority: "urgent" | "push" | "silent" | null;
  lowConfidenceFlagCount: number;
  hasCachedDraft: boolean;
  cachedDraftStale: boolean;
  sendingAddress: string | null;
  keepPinned: boolean;
  snoozedUntilMs: number | null;
  isUnread: boolean;
  lastMessageAtMs: number;
};

export type DraftListRow = {
  kind: "draft";
  id: string;
  threadId: string | null;
  subject: string | null;
  previewText: string;
  senderLabel: string;
  contactName: string | null;
  companyName: string | null;
  channel: "email";
  priorityClass: "signal";
  notificationPriority: null;
  lowConfidenceFlagCount: 0;
  hasCachedDraft: false;
  cachedDraftStale: false;
  sendingAddress: string;
  keepPinned: false;
  snoozedUntilMs: null;
  isUnread: false;
  lastMessageAtMs: number;
};

export type InboxListRow = ThreadListRow | DraftListRow;

export type ListThreadsInput = {
  view: InboxView;
  addressFilter?: InboxAddressFilter;
  sort?: InboxSortOrder;
  adminUserId: string;
  now?: number;
  limit?: number;
};

export type ListThreadsResult = {
  rows: InboxListRow[];
  hasMore: boolean;
};

function previewFromBody(body: string | null | undefined): string {
  if (!body) return "";
  return body.replace(/\s+/g, " ").trim().slice(0, 140);
}

function countLowConfidenceFlags(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return (raw as DraftReplyLowConfidenceFlag[]).length;
}

function isThreadUnread(
  lastInboundMs: number | null,
  lastOutboundMs: number | null,
): boolean {
  if (lastInboundMs === null) return false;
  if (lastOutboundMs === null) return true;
  return lastInboundMs > lastOutboundMs;
}

/**
 * Spec §4.1 left-nav filter resolution. Returns rows shaped for the
 * thread-list renderer, including the Drafts view which renders
 * `compose_drafts` rows with the same layout.
 */
export async function listThreads(
  input: ListThreadsInput,
): Promise<ListThreadsResult> {
  const addressFilter = input.addressFilter ?? "all";
  const sort = input.sort ?? "recent";
  const now = input.now ?? Date.now();
  const limit = input.limit ?? THREAD_LIST_PAGE_SIZE;

  if (input.view === "drafts") {
    return listDrafts({ adminUserId: input.adminUserId, addressFilter, limit });
  }

  const conditions = [];

  if (input.view !== "trash") {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${messages} WHERE ${messages.thread_id} = ${threads.id} AND ${messages.deleted_at_ms} IS NULL)`,
    );
  }

  switch (input.view) {
    case "focus":
      conditions.push(eq(threads.priority_class, "signal"));
      conditions.push(
        or(isNull(threads.snoozed_until_ms), sql`${threads.snoozed_until_ms} <= ${now}`)!,
      );
      break;
    case "all":
      conditions.push(
        or(isNull(threads.snoozed_until_ms), sql`${threads.snoozed_until_ms} <= ${now}`)!,
      );
      break;
    case "noise":
      conditions.push(eq(threads.priority_class, "noise"));
      break;
    case "support":
      conditions.push(eq(threads.sending_address, "support@"));
      break;
    case "sent":
      conditions.push(isNull(threads.last_inbound_at_ms));
      conditions.push(isNotNull(threads.last_outbound_at_ms));
      break;
    case "snoozed":
      conditions.push(isNotNull(threads.snoozed_until_ms));
      conditions.push(gt(threads.snoozed_until_ms, now));
      break;
    case "trash":
      conditions.push(
        sql`NOT EXISTS (SELECT 1 FROM ${messages} WHERE ${messages.thread_id} = ${threads.id} AND ${messages.deleted_at_ms} IS NULL)`,
      );
      break;
    case "spam":
      conditions.push(eq(threads.priority_class, "spam"));
      break;
  }

  if (addressFilter !== "all") {
    conditions.push(eq(threads.sending_address, addressFilter));
  }

  const whereExpr = conditions.length === 0 ? undefined : and(...conditions);

  const orderBy =
    sort === "priority_first"
      ? [
          sql`CASE ${threads.priority_class} WHEN 'signal' THEN 0 WHEN 'noise' THEN 1 WHEN 'spam' THEN 2 ELSE 3 END`,
          desc(threads.last_message_at_ms),
        ]
      : sort === "unread_first"
        ? [
            sql`CASE WHEN ${threads.last_inbound_at_ms} IS NOT NULL AND (${threads.last_outbound_at_ms} IS NULL OR ${threads.last_inbound_at_ms} > ${threads.last_outbound_at_ms}) THEN 0 ELSE 1 END`,
            desc(threads.last_message_at_ms),
          ]
        : [desc(threads.keep_pinned), desc(threads.last_message_at_ms)];

  const rows = await db
    .select({
      thread: threads,
      contact_name: contacts.name,
      company_name: companies.name,
    })
    .from(threads)
    .leftJoin(contacts, eq(contacts.id, threads.contact_id))
    .leftJoin(companies, eq(companies.id, threads.company_id))
    .where(whereExpr)
    .orderBy(...orderBy)
    .limit(limit + 1);

  const windowed = rows.slice(0, limit);
  const threadIds = windowed.map((r) => r.thread.id);

  const latestPreviews =
    threadIds.length === 0
      ? new Map<string, { body: string | null; subject: string | null; channel: string; from: string }>()
      : await loadLatestPreviews(threadIds);

  const listRows: ThreadListRow[] = windowed.map((r) => {
    const latest = latestPreviews.get(r.thread.id);
    const senderLabel = r.contact_name ?? latest?.from ?? r.thread.contact_id ?? "Unknown sender";
    return {
      kind: "thread",
      id: r.thread.id,
      threadId: r.thread.id,
      subject: r.thread.subject,
      previewText: previewFromBody(latest?.body ?? null),
      senderLabel,
      contactName: r.contact_name ?? null,
      companyName: r.company_name ?? null,
      channel: latest?.channel ?? r.thread.channel_of_origin,
      priorityClass: r.thread.priority_class,
      notificationPriority: null,
      lowConfidenceFlagCount: countLowConfidenceFlags(
        r.thread.cached_draft_low_confidence_flags,
      ),
      hasCachedDraft: r.thread.has_cached_draft,
      cachedDraftStale: r.thread.cached_draft_stale,
      sendingAddress: r.thread.sending_address,
      keepPinned: r.thread.keep_pinned,
      snoozedUntilMs: r.thread.snoozed_until_ms,
      isUnread: isThreadUnread(
        r.thread.last_inbound_at_ms,
        r.thread.last_outbound_at_ms,
      ),
      lastMessageAtMs: r.thread.last_message_at_ms,
    };
  });

  return { rows: listRows, hasMore: rows.length > limit };
}

async function loadLatestPreviews(threadIds: string[]): Promise<
  Map<
    string,
    { body: string | null; subject: string | null; channel: string; from: string }
  >
> {
  const rows = await db
    .select({
      thread_id: messages.thread_id,
      body_text: messages.body_text,
      subject: messages.subject,
      channel: messages.channel,
      from_address: messages.from_address,
      created_at_ms: messages.created_at_ms,
    })
    .from(messages)
    .where(
      and(
        sql`${messages.thread_id} IN (${sql.join(
          threadIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
        isNull(messages.deleted_at_ms),
      ),
    )
    .orderBy(desc(messages.created_at_ms));

  const out = new Map<
    string,
    { body: string | null; subject: string | null; channel: string; from: string }
  >();
  for (const row of rows) {
    if (out.has(row.thread_id)) continue;
    out.set(row.thread_id, {
      body: row.body_text,
      subject: row.subject,
      channel: row.channel,
      from: row.from_address,
    });
  }
  return out;
}

async function listDrafts({
  adminUserId,
  addressFilter,
  limit,
}: {
  adminUserId: string;
  addressFilter: InboxAddressFilter;
  limit: number;
}): Promise<ListThreadsResult> {
  const conditions = [eq(compose_drafts.author_user_id, adminUserId)];
  if (addressFilter !== "all") {
    conditions.push(eq(compose_drafts.sending_address, addressFilter));
  }

  const rows = await db
    .select({
      draft: compose_drafts,
      contact_name: contacts.name,
      company_name: companies.name,
    })
    .from(compose_drafts)
    .leftJoin(contacts, eq(contacts.id, compose_drafts.contact_id))
    .leftJoin(companies, eq(companies.id, compose_drafts.company_id))
    .where(and(...conditions))
    .orderBy(desc(compose_drafts.updated_at_ms))
    .limit(limit + 1);

  const windowed = rows.slice(0, limit);

  const listRows: DraftListRow[] = windowed.map((r) => {
    const to = r.draft.to_addresses ?? [];
    const recipientLabel = r.contact_name ?? to[0] ?? "No recipient yet";
    return {
      kind: "draft",
      id: `draft_${r.draft.id}`,
      threadId: r.draft.thread_id,
      subject: r.draft.subject,
      previewText: previewFromBody(r.draft.body_text),
      senderLabel: `To: ${recipientLabel}`,
      contactName: r.contact_name ?? null,
      companyName: r.company_name ?? null,
      channel: "email",
      priorityClass: "signal",
      notificationPriority: null,
      lowConfidenceFlagCount: 0,
      hasCachedDraft: false,
      cachedDraftStale: false,
      sendingAddress: r.draft.sending_address,
      keepPinned: false,
      snoozedUntilMs: null,
      isUnread: false,
      lastMessageAtMs: r.draft.updated_at_ms,
    };
  });

  return { rows: listRows, hasMore: rows.length > limit };
}
