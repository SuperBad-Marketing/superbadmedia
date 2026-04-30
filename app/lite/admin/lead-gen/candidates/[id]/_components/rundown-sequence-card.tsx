import type { SequenceEmailStatus } from "@/lib/rundown/sequence-queries";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: {
    bg: "rgba(253, 245, 230, 0.06)",
    text: "var(--color-neutral-500)",
    label: "Pending",
  },
  sent: {
    bg: "rgba(59, 130, 246, 0.1)",
    text: "#93c5fd",
    label: "Sent",
  },
  cancelled: {
    bg: "rgba(253, 245, 230, 0.04)",
    text: "var(--color-neutral-600)",
    label: "Cancelled",
  },
  failed: {
    bg: "rgba(239, 68, 68, 0.1)",
    text: "#fca5a5",
    label: "Failed",
  },
};

const EMAIL_LABELS = ["The Gap", "The Plan", "The Close"] as const;

function formatTimestamp(ms: number | null): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function RundownSequenceCard({
  emails,
}: {
  emails: SequenceEmailStatus[];
}) {
  if (emails.length === 0) return null;

  const track = emails[0].track === "melbourne" ? "Melbourne" : "Non-Melbourne";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Rundown Sequence
        </div>
        <span
          className="rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            letterSpacing: "1.2px",
            backgroundColor: "rgba(178, 40, 72, 0.15)",
            color: "var(--color-brand-pink)",
          }}
        >
          {track}
        </span>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        {emails.map((email, idx) => {
          const style = STATUS_STYLES[email.status] ?? STATUS_STYLES.pending;
          const label = EMAIL_LABELS[email.emailNumber - 1] ?? `Email ${email.emailNumber}`;

          return (
            <div
              key={email.id}
              className="px-5 py-4"
              style={{
                borderBottom: idx < emails.length - 1 ? "1px solid rgba(253, 245, 230, 0.04)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="font-[family-name:var(--font-display)] text-[18px] text-[color:var(--color-brand-cream)]"
                    style={{ letterSpacing: "-0.3px" }}
                  >
                    {label}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] uppercase font-[family-name:var(--font-label)]"
                    style={{
                      letterSpacing: "1px",
                      backgroundColor: style.bg,
                      color: style.text,
                    }}
                  >
                    {style.label}
                  </span>
                </div>
                <span className="font-mono text-[12px] text-[color:var(--color-neutral-500)]">
                  Email {email.emailNumber}/3
                </span>
              </div>

              {email.subject && (
                <p className="mt-1.5 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-400)]">
                  {email.subject}
                </p>
              )}

              {email.status === "sent" && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[color:var(--color-neutral-500)]">
                  <span>Sent {formatTimestamp(email.sentAtMs)}</span>
                  {email.openedAtMs && (
                    <span style={{ color: "#93c5fd" }}>
                      Opened {email.openCount > 1 ? `${email.openCount}x` : ""} {formatTimestamp(email.openedAtMs)}
                    </span>
                  )}
                  {email.clickedAtMs && (
                    <span style={{ color: "var(--color-brand-pink)" }}>
                      Clicked {formatTimestamp(email.clickedAtMs)}
                    </span>
                  )}
                  {email.replyReceivedAtMs && (
                    <span style={{ color: "var(--color-brand-orange)" }}>
                      Reply ({email.replyClassification ?? "unknown"}) {formatTimestamp(email.replyReceivedAtMs)}
                    </span>
                  )}
                </div>
              )}

              {email.status === "cancelled" && email.cancelReason && (
                <p className="mt-1.5 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)]">
                  {email.cancelReason.replace(/_/g, " ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
