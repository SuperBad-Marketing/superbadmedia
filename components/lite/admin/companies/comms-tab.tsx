import type { ThreadRow, MessageRow } from "@/lib/db/schema/messages";
import type { ContactRow } from "@/lib/db/schema/contacts";
import Link from "next/link";
import { ThreadDetail } from "@/components/lite/admin/shared/thread-detail";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
}

const CHANNEL_ICONS: Record<string, string> = {
  email: "mail",
  sms: "sms",
  portal_chat: "chat",
  instagram_dm: "ig",
  facebook_messenger: "fb",
  whatsapp: "wa",
  outreach_reply: "mail",
  newsletter_reply: "mail",
  task_feedback: "task",
};

const TICKET_STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "var(--color-brand-orange)", bg: "rgba(242, 140, 82, 0.14)" },
  waiting_on_customer: { label: "Waiting", color: "var(--color-neutral-500)", bg: "rgba(128, 127, 115, 0.15)" },
  resolved: { label: "Resolved", color: "var(--color-success)", bg: "rgba(123, 174, 126, 0.14)" },
};

function TicketStatusBadge({ status }: { status: string }) {
  const style = TICKET_STATUS_STYLE[status] ?? TICKET_STATUS_STYLE.open;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{ letterSpacing: "1.5px", background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

export function CommsTab({
  threads,
  contacts,
  companyId,
  focusedThreadId,
  focusedThread,
  focusedMessages,
}: {
  threads: ThreadRow[];
  contacts: ContactRow[];
  companyId: string;
  focusedThreadId?: string | null;
  focusedThread?: ThreadRow | null;
  focusedMessages?: MessageRow[] | null;
}) {
  if (focusedThreadId && focusedThread && focusedMessages) {
    return (
      <ThreadDetail
        threadId={focusedThread.id}
        threadSubject={focusedThread.subject ?? "Untitled thread"}
        messages={focusedMessages}
        backHref={`/lite/admin/companies/${companyId}?tab=comms`}
      />
    );
  }

  if (threads.length === 0) {
    return (
      <div className="px-4 pb-10">
        <div className="px-8 py-10 text-center">
          <p
            className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
            style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
          >
            No conversations yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            radio silence. for now.
          </p>
        </div>
      </div>
    );
  }

  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  return (
    <div className="space-y-0 px-4 pb-10">
      <div
        className="overflow-hidden rounded-[12px]"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div
          className="flex items-baseline justify-between px-5 py-3"
          style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
        >
          <h2
            className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.8px" }}
          >
            Threads
          </h2>
          <span
            className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {threads.length}
          </span>
        </div>
        <div>
          {threads.map((thread) => {
            const contact = thread.contact_id ? contactMap.get(thread.contact_id) : null;
            const channelLabel = CHANNEL_ICONS[thread.channel_of_origin] ?? thread.channel_of_origin;
            const lastMsgMs = thread.last_message_at_ms ?? thread.created_at_ms;
            return (
              <Link
                key={thread.id}
                href={`/lite/admin/companies/${companyId}?tab=comms&thread=${thread.id}`}
                scroll={false}
                className="flex items-start gap-4 px-5 py-3.5 transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.02)]"
                style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-[family-name:var(--font-label)] text-[9px] uppercase"
                  style={{
                    letterSpacing: "1px",
                    background: "rgba(253, 245, 230, 0.04)",
                    color: "var(--color-neutral-500)",
                  }}
                >
                  {channelLabel}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                      {thread.subject ?? (contact?.name ? `Conversation with ${contact.name}` : "Untitled thread")}
                    </p>
                    {thread.ticket_status && (
                      <TicketStatusBadge status={thread.ticket_status} />
                    )}
                    {thread.has_cached_draft && (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
                        style={{
                          letterSpacing: "1.2px",
                          background: "rgba(244, 160, 176, 0.10)",
                          color: "var(--color-brand-pink)",
                        }}
                      >
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-[color:var(--color-neutral-500)]">
                    {contact && <span>{contact.name}</span>}
                    <span>{formatDate(lastMsgMs)} at {formatTime(lastMsgMs)}</span>
                  </div>
                </div>
                {thread.priority_class === "signal" && (
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--color-brand-pink)" }}
                    title="Signal"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
