"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DraftReplyLowConfidenceFlag } from "@/lib/graph/draft-reply";

/**
 * Render a draft body with low-confidence spans highlighted inline.
 * Spec §16 #63: flag is a hint, not a warning. Brand-accent pink
 * underline, not brand-red.
 *
 * We lay flags over the read-only preview. The textarea itself never
 * has overlays (no browser support). This component is used either as
 * a preview above the textarea or inside the refine sidecar.
 */
export function LowConfidenceFlags({
  body,
  flags,
  className,
}: {
  body: string;
  flags: DraftReplyLowConfidenceFlag[];
  className?: string;
}) {
  const segments = React.useMemo(() => splitBody(body, flags), [body, flags]);

  if (flags.length === 0) {
    return (
      <div
        className={cn(
          "whitespace-pre-wrap break-words font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-300)]",
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "whitespace-pre-wrap break-words font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-300)]",
        className,
      )}
    >
      {segments.map((seg, idx) =>
        seg.kind === "text" ? (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        ) : (
          <mark
            key={idx}
            title={seg.flag.reason}
            className="rounded-sm bg-transparent px-0.5 text-[color:var(--color-brand-cream)] underline decoration-[color:var(--color-brand-pink)] decoration-2 underline-offset-2"
          >
            {seg.text}
          </mark>
        ),
      )}
    </div>
  );
}

type Segment =
  | { kind: "text"; text: string }
  | { kind: "flag"; text: string; flag: DraftReplyLowConfidenceFlag };

function splitBody(
  body: string,
  flags: DraftReplyLowConfidenceFlag[],
): Segment[] {
  if (flags.length === 0) return [{ kind: "text", text: body }];

  // Find each flag's span by substring match; earliest occurrence wins.
  const hits: { start: number; end: number; flag: DraftReplyLowConfidenceFlag }[] = [];
  let cursor = 0;
  for (const flag of flags) {
    if (!flag.span) continue;
    const idx = body.indexOf(flag.span, cursor);
    if (idx >= 0) {
      hits.push({ start: idx, end: idx + flag.span.length, flag });
      cursor = idx + flag.span.length;
    }
  }
  hits.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let pos = 0;
  for (const hit of hits) {
    if (hit.start < pos) continue;
    if (hit.start > pos) {
      out.push({ kind: "text", text: body.slice(pos, hit.start) });
    }
    out.push({
      kind: "flag",
      text: body.slice(hit.start, hit.end),
      flag: hit.flag,
    });
    pos = hit.end;
  }
  if (pos < body.length) {
    out.push({ kind: "text", text: body.slice(pos) });
  }
  return out;
}
