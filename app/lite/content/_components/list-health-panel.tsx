/**
 * Subscriber list health panel (CE-11).
 *
 * Spec §4.3: "Subscriber sees a read-only list health panel: bounce rate,
 * unsubscribe rate, inactive %, recent removals with reasons."
 *
 * Server component — rendered inside the List tab page.
 */

import type { ListHealthStats } from "@/lib/content-engine/subscriber-list";

interface ListHealthPanelProps {
  health: ListHealthStats;
}

const REMOVAL_STATUS_LABELS: Record<string, string> = {
  bounced: "Bounced",
  unsubscribed: "Unsubscribed",
  inactive_removed: "Inactive",
};

export function ListHealthPanel({ health }: ListHealthPanelProps) {
  if (health.total === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <h3 className="mb-2 text-sm font-medium">List health</h3>
        <p className="text-xs text-muted-foreground">
          No subscribers to report on yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="mb-3 text-sm font-medium">List health</h3>

      {/* Rate cards */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <RateCard
          label="Bounce rate"
          value={health.bounceRate}
          severity={health.bounceRate > 5 ? "warn" : "ok"}
        />
        <RateCard
          label="Unsub rate"
          value={health.unsubscribeRate}
          severity={health.unsubscribeRate > 2 ? "warn" : "ok"}
        />
        <RateCard
          label="Inactive"
          value={health.inactiveRate}
          severity={health.inactiveRate > 10 ? "warn" : "ok"}
        />
      </div>

      {/* Counts */}
      <div className="mb-4 grid grid-cols-5 gap-2 text-center text-xs">
        <CountCell label="Total" value={health.total} />
        <CountCell label="Active" value={health.active} />
        <CountCell label="Pending" value={health.pendingConfirmation} />
        <CountCell label="Bounced" value={health.bounced} />
        <CountCell label="Removed" value={health.unsubscribed + health.inactiveRemoved} />
      </div>

      {/* Recent removals */}
      {health.recentRemovals.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Recent removals
          </h4>
          <div className="space-y-1">
            {health.recentRemovals.map((r, i) => (
              <div
                key={`${r.email}-${i}`}
                className="flex items-center justify-between rounded bg-neutral-50 px-3 py-1.5 text-xs"
              >
                <span className="truncate font-mono text-neutral-600">
                  {r.email}
                </span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {REMOVAL_STATUS_LABELS[r.status] ?? r.status}
                  {r.removedAtMs && (
                    <>
                      {" · "}
                      {new Date(r.removedAtMs).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RateCard({
  label,
  value,
  severity,
}: {
  label: string;
  value: number;
  severity: "ok" | "warn";
}) {
  return (
    <div className="rounded-md border border-border p-2.5 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          severity === "warn" ? "text-amber-600" : "text-foreground"
        }`}
      >
        {value}%
      </p>
    </div>
  );
}

function CountCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}
