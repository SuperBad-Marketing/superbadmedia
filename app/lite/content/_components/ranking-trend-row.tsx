/**
 * Ranking trend table row for the Metrics tab (CE-10).
 *
 * Displays keyword, entry/current/peak positions, and a direction
 * indicator. Server component — no client interactivity needed.
 */
import type { PostRankingTrend } from "@/lib/content-engine/ranking-snapshot";

const DIRECTION_DISPLAY: Record<
  PostRankingTrend["direction"],
  { label: string; className: string }
> = {
  up: { label: "↑ Up", className: "text-success" },
  down: { label: "↓ Down", className: "text-destructive" },
  stable: { label: "— Stable", className: "text-muted-foreground" },
  new: { label: "★ New", className: "text-brand-pink" },
  lost: { label: "✕ Lost", className: "text-destructive" },
};

export function RankingTrendRow({ trend }: { trend: PostRankingTrend }) {
  const dir = DIRECTION_DISPLAY[trend.direction];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="max-w-[200px] truncate px-4 py-2">{trend.keyword}</td>
      <td className="px-4 py-2 text-right tabular-nums">
        {trend.entryPosition ?? "—"}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {trend.currentPosition ?? "—"}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {trend.peakPosition ?? "—"}
      </td>
      <td className={`px-4 py-2 text-right text-xs font-medium ${dir.className}`}>
        {dir.label}
      </td>
    </tr>
  );
}
