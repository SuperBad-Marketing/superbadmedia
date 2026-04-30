import type { RundownSequenceMetrics } from "@/lib/rundown/sequence-queries";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div>
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.5px" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 font-mono text-[11px] text-[color:var(--color-neutral-500)]">
          {sub}
        </div>
      )}
    </div>
  );
}

function MiniBar({
  label,
  sent,
  opened,
  clicked,
  replied,
}: {
  label: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}) {
  const openPct = sent > 0 ? (opened / sent) * 100 : 0;
  const clickPct = sent > 0 ? (clicked / sent) * 100 : 0;
  const replyPct = sent > 0 ? (replied / sent) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]" style={{ letterSpacing: "1px" }}>
          {label}
        </span>
        <span className="font-mono text-[11px] text-[color:var(--color-neutral-500)]">
          {sent} sent
        </span>
      </div>
      <div className="flex gap-1 h-2">
        <div
          className="rounded-full"
          style={{
            width: `${Math.max(openPct, 2)}%`,
            backgroundColor: "#93c5fd",
          }}
          title={`${Math.round(openPct)}% opened`}
        />
        <div
          className="rounded-full"
          style={{
            width: `${Math.max(clickPct, 2)}%`,
            backgroundColor: "var(--color-brand-pink)",
          }}
          title={`${Math.round(clickPct)}% clicked`}
        />
        <div
          className="rounded-full"
          style={{
            width: `${Math.max(replyPct, 2)}%`,
            backgroundColor: "var(--color-brand-orange)",
          }}
          title={`${Math.round(replyPct)}% replied`}
        />
      </div>
      <div className="mt-1 flex gap-3 font-mono text-[10px] text-[color:var(--color-neutral-600)]">
        <span style={{ color: "#93c5fd" }}>{Math.round(openPct)}% open</span>
        <span style={{ color: "var(--color-brand-pink)" }}>{Math.round(clickPct)}% click</span>
        <span style={{ color: "var(--color-brand-orange)" }}>{Math.round(replyPct)}% reply</span>
      </div>
    </div>
  );
}

export function RundownMetricsCard({
  metrics,
}: {
  metrics: RundownSequenceMetrics;
}) {
  if (metrics.totalScheduled === 0) return null;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.03)",
      }}
    >
      <div
        className="mb-5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Rundown Nurture Sequence
      </div>

      <div className="grid grid-cols-3 gap-6 sm:grid-cols-6">
        <Stat label="Scheduled" value={metrics.totalScheduled} />
        <Stat label="Sent" value={metrics.totalSent} />
        <Stat label="Opened" value={metrics.totalOpened} sub={`${metrics.openRate}%`} />
        <Stat label="Clicked" value={metrics.totalClicked} sub={`${metrics.clickRate}%`} />
        <Stat label="Replied" value={metrics.totalReplied} sub={`${metrics.replyRate}%`} />
        <Stat label="Cancelled" value={metrics.totalCancelled} />
      </div>

      <div className="mt-6 space-y-4">
        {metrics.byEmailNumber.map((e) => (
          <MiniBar
            key={e.emailNumber}
            label={
              e.emailNumber === 1
                ? "Email 1 — The Gap"
                : e.emailNumber === 2
                  ? "Email 2 — The Plan"
                  : "Email 3 — The Close"
            }
            sent={e.sent}
            opened={e.opened}
            clicked={e.clicked}
            replied={e.replied}
          />
        ))}
      </div>

      {Object.keys(metrics.replyClassifications).length > 0 && (
        <div className="mt-5 pt-4" style={{ borderTop: "1px solid rgba(253, 245, 230, 0.04)" }}>
          <div
            className="mb-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Reply Breakdown
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(metrics.replyClassifications).map(([cls, count]) => (
              <span
                key={cls}
                className="rounded-full px-2.5 py-1 font-mono text-[11px]"
                style={{
                  backgroundColor: "rgba(253, 245, 230, 0.06)",
                  color: "var(--color-neutral-400)",
                }}
              >
                {cls.replace(/_/g, " ")} · {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
