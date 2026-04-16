"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type { ThreadRow, MessageRow } from "@/lib/db/schema/messages";
import type { ContactRow } from "@/lib/db/schema/contacts";
import type { CompanyRow } from "@/lib/db/schema/companies";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";
import type { SupportCustomerContext } from "../_queries/load-support-customer-context";
import type {
  InboxAddressFilter,
  InboxSortOrder,
  InboxView,
} from "../_queries/list-threads";
import { ConversationStream } from "./conversation-stream";
import { ReplyComposer } from "./reply-composer";
import { TicketOverlay } from "./ticket-overlay";
import { MobileCustomerContextSheet } from "./mobile-customer-context-sheet";

/**
 * Full-screen mobile thread detail (spec §4.5). Wraps UI-8's existing
 * pieces: ConversationStream + ReplyComposer (mobile variant) + ticket
 * overlay with "Details" button → MobileCustomerContextSheet.
 *
 * Back button returns to the list by clearing `thread` + `tab` params.
 * §16 #60 preservation is inherited from ReplyComposer's own
 * rehydration rules — this component passes `threadId` unchanged and
 * lets the composer own dirty-body survival.
 */

function buildBackHref(params: {
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  tab: string;
}): string {
  const search = new URLSearchParams();
  search.set("view", params.view);
  if (params.address !== "all") search.set("address", params.address);
  if (params.sort !== "recent") search.set("sort", params.sort);
  search.set("tab", params.tab);
  return `/lite/inbox?${search.toString()}`;
}

export function MobileThreadDetail({
  thread,
  messages,
  contact,
  company,
  customerContext,
  sendEnabled,
  llmEnabled,
  view,
  address,
  sort,
  tab,
}: {
  thread: ThreadRow;
  messages: MessageRow[];
  contact: ContactRow | null;
  company: CompanyRow | null;
  customerContext: SupportCustomerContext | null;
  sendEnabled: boolean;
  llmEnabled: boolean;
  view: InboxView;
  address: InboxAddressFilter;
  sort: InboxSortOrder;
  tab: string;
}) {
  const reducedMotion = useReducedMotion();
  const [contextOpen, setContextOpen] = React.useState(false);

  const flags: DraftReplyLowConfidenceFlag[] = Array.isArray(
    thread.cached_draft_low_confidence_flags,
  )
    ? (thread.cached_draft_low_confidence_flags as DraftReplyLowConfidenceFlag[])
    : [];

  const inboundFrom = [...messages]
    .reverse()
    .find((m) => m.direction === "inbound")?.from_address;
  const toAddresses = inboundFrom
    ? [inboundFrom]
    : contact?.email
      ? [contact.email]
      : [];

  const isSupport = thread.sending_address === "support@";

  return (
    <motion.div
      key={thread.id}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={reducedMotion ? { duration: 0.18 } : houseSpring}
      className="flex h-full flex-col"
    >
      <header className="flex items-center gap-2 border-b border-[color:var(--color-neutral-700)] bg-[color:var(--color-surface-1)] px-3 py-3">
        <Link
          href={buildBackHref({ view, address, sort, tab })}
          aria-label="Back to inbox list"
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm",
            "text-[color:var(--color-neutral-300)] outline-none",
            "hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
            "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
          )}
        >
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] font-semibold text-[color:var(--color-neutral-100)]">
            {thread.subject ?? "(no subject)"}
          </h1>
          <p className="truncate font-[family-name:var(--font-dm-sans)] text-[length:var(--text-micro)] text-[color:var(--color-neutral-500)]">
            {contact?.name ?? inboundFrom ?? "Unknown"}
            {company?.name ? ` · ${company.name}` : ""}
          </p>
        </div>
      </header>

      {isSupport && (
        <div className="flex items-center gap-2 border-b border-[color:var(--color-neutral-700)]">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TicketOverlay
              threadId={thread.id}
              ticketType={thread.ticket_type}
              ticketStatus={thread.ticket_status ?? "open"}
              ticketTypeAssignedBy={thread.ticket_type_assigned_by}
            />
          </div>
          {customerContext && (
            <button
              type="button"
              onClick={() => setContextOpen(true)}
              aria-label="Customer details"
              className={cn(
                "mr-3 flex h-9 shrink-0 items-center gap-1 rounded-sm border border-[color:var(--color-neutral-700)] px-2",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)] text-[color:var(--color-neutral-300)]",
                "outline-none transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
              )}
            >
              <Info size={12} strokeWidth={1.75} aria-hidden />
              Details
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ConversationStream messages={messages} sendEnabled={sendEnabled} />
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
        ticketStatus={thread.ticket_status ?? null}
        sendEnabled={sendEnabled}
        llmEnabled={llmEnabled}
        variant="mobile"
      />

      {isSupport && customerContext && (
        <MobileCustomerContextSheet
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          contactName={contact?.name ?? null}
          context={customerContext}
        />
      )}
    </motion.div>
  );
}
