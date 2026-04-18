import type { PortalChatMessageRow } from "@/lib/db/schema/portal-chat-messages";

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

function ChatMessage({ msg }: { msg: PortalChatMessageRow }) {
  const isClient = msg.role === "client";
  return (
    <div
      className="flex flex-col gap-1 px-5 py-2.5"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
          style={{
            letterSpacing: "1.5px",
            background: isClient
              ? "rgba(244, 160, 176, 0.10)"
              : "rgba(253, 245, 230, 0.04)",
            color: isClient
              ? "var(--color-brand-pink)"
              : "var(--color-neutral-500)",
          }}
        >
          {isClient ? "Client" : "Bartender"}
        </span>
        <span className="text-[10px] text-[color:var(--color-neutral-500)]">
          {formatDate(msg.created_at_ms)} at {formatTime(msg.created_at_ms)}
        </span>
        {msg.escalated_to_inbox && (
          <span
            className="inline-flex items-center rounded-full px-2 py-[1px] font-[family-name:var(--font-label)] text-[9px] uppercase"
            style={{
              letterSpacing: "1.2px",
              background: "rgba(242, 140, 82, 0.14)",
              color: "var(--color-brand-orange)",
            }}
          >
            Escalated
          </span>
        )}
        {msg.tool_action && (
          <span className="text-[10px] italic text-[color:var(--color-neutral-500)]">
            Action: {msg.tool_action}
          </span>
        )}
      </div>
      <p className="text-[13px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        {msg.content}
      </p>
    </div>
  );
}

export function ContactPortalChatTab({
  chatMessages,
}: {
  chatMessages: PortalChatMessageRow[];
}) {
  if (chatMessages.length === 0) {
    return (
      <div className="px-4 pb-10">
        <div className="px-8 py-10 text-center">
          <p
            className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
            style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
          >
            No portal chats yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            the bartender&rsquo;s waiting.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-10">
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Read-only admin view · {chatMessages.length} message{chatMessages.length === 1 ? "" : "s"}
      </p>
      <div
        className="overflow-hidden rounded-[12px]"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div>
          {chatMessages.map((msg) => (
            <ChatMessage key={msg.id} msg={msg} />
          ))}
        </div>
      </div>
    </div>
  );
}
