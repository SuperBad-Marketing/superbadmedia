"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bookmark, BookmarkX, ExternalLink, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ThreadRow, MessageRow } from "@/lib/db/schema/messages";
import type { ContactRow } from "@/lib/db/schema/contacts";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import type {
  InboxAddressFilter,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { ConversationStream } from "./conversation-stream";
import { ReplyComposer } from "./reply-composer";

function buildConversationHref(
  view: InboxView,
  address: InboxAddressFilter,
  sort: InboxSortOrder,
  threadId: string,
  contactId: string,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  if (sort !== "recent") params.set("sort", sort);
  params.set("thread", threadId);
  params.set("conversationWith", contactId);
  return `/lite/inbox?${params.toString()}`;
}

export function ThreadDetail({
  thread,
  messages,
  contact,
  company,
  sendEnabled,
  llmEnabled,
  view,
  address,
  sort,
}: {
  thread: ThreadRow;
  messages: MessageRow[];
  contact: ContactRow | null;
  company: CompanyRow | null;
  sendEnabled: boolean;
  llmEnabled: boolean;
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
}) {
  const flags: DraftReplyLowConfidenceFlag[] = Array.isArray(
    thread.cached_draft_low_confidence_flags,
  )
    ? (thread.cached_draft_low_confidence_flags as DraftReplyLowConfidenceFlag[])
    : [];

  const inboundFrom = [...messages]
    .reverse()
    .find((m) => m.direction === "inbound")?.from_address;
  const toAddresses = inboundFrom ? [inboundFrom] : contact?.email ? [contact.email] : [];

  return (
    <motion.div
      key={thread.id}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-[color:var(--color-neutral-700)] px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <span
            className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Thread · {thread.channel_of_origin}
          </span>
          <h1
            className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            {thread.subject ?? "(no subject)"}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]">
            {contact ? (
              <Link
                href={buildConversationHref(
                  view,
                  address,
                  sort,
                  thread.id,
                  contact.id,
                )}
                title={`Open every thread with ${contact.name}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 outline-none",
                  "bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-300)]",
                  "transition-colors hover:bg-[color:var(--color-surface-3)] hover:text-[color:var(--color-neutral-100)]",
                  "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-background)]",
                )}
              >
                {contact.name}
                <ExternalLink size={10} strokeWidth={1.5} aria-hidden />
              </Link>
            ) : (
              <span
                aria-disabled="true"
                title="Walk-in thread — no linked contact yet."
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5",
                  "bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-500)]",
                  "cursor-not-allowed",
                )}
              >
                Unknown contact
                <ExternalLink size={10} strokeWidth={1.5} aria-hidden />
              </span>
            )}
            {company && (
              <span className="text-[color:var(--color-neutral-500)]">
                · {company.name}
              </span>
            )}
            {thread.sending_address === "support@" && (
              <span
                className="inline-flex items-center gap-1 rounded-sm bg-[color:var(--color-surface-2)] px-2 py-0.5 text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]"
                title="Ticket UI lands in UI-10."
              >
                <Info size={10} strokeWidth={1.75} aria-hidden />
                support — ticket UI in UI-10
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <KeepToggle keepPinned={thread.keep_pinned} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ConversationStream messages={messages} />
      </div>

      <ReplyComposer
        threadId={thread.id}
        contactId={thread.contact_id}
        companyId={thread.company_id}
        toAddresses={toAddresses}
        sendingAddress={thread.sending_address ?? "andy@"}
        subject={thread.subject}
        cachedDraftBody={thread.cached_draft_body}
        cachedDraftStale={thread.cached_draft_stale}
        lowConfidenceFlags={flags}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
      />
    </motion.div>
  );
}

function KeepToggle({ keepPinned }: { keepPinned: boolean }) {
  const [pinned, setPinned] = React.useState(keepPinned);
  const Icon = pinned ? Bookmark : BookmarkX;
  return (
    <button
      type="button"
      onClick={() => setPinned((v) => !v)}
      title={pinned ? "Pinned — click to unpin" : "Pin this thread"}
      className={cn(
        "flex items-center gap-1.5 rounded-sm border border-[color:var(--color-neutral-700)] px-2 py-1",
        "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
        "outline-none transition-colors hover:bg-[color:var(--color-surface-2)]",
        pinned
          ? "text-[color:var(--color-accent-cta)]"
          : "text-[color:var(--color-neutral-300)]",
      )}
    >
      <Icon size={12} strokeWidth={1.75} aria-hidden />
      Keep
    </button>
  );
}

export function ThreadDetailEmpty() {
  return (
    <div
      role="status"
      className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
    >
      <span
        className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Thread
      </span>
      <h2 className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-h3)] text-[color:var(--color-neutral-100)]">
        Pick a thread.
      </h2>
      <em className="font-[family-name:var(--font-narrative)] text-[length:var(--text-body)] text-[color:var(--color-brand-pink)]">
        or write a new one — the Compose button&rsquo;s up there.
      </em>
    </div>
  );
}
