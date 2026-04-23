"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { runKeywordResearchAction } from "../actions";

interface RunResearchButtonProps {
  companyId: string;
}

export function RunResearchButton({ companyId }: RunResearchButtonProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleClick() {
    setRunning(true);
    setResult(null);

    const res = await runKeywordResearchAction(companyId);
    setRunning(false);

    if (res.ok) {
      if (res.topicsQueued === 0 && res.skipped > 0) {
        setResult({
          type: "success",
          message: `All ${res.skipped} keywords already have topics queued.`,
        });
      } else if (res.topicsQueued === 0) {
        setResult({
          type: "success",
          message: "No new topics found. Try adding more seed keywords.",
        });
      } else {
        setResult({
          type: "success",
          message: `${res.topicsQueued} new topic${res.topicsQueued === 1 ? "" : "s"} queued${res.skipped > 0 ? `, ${res.skipped} skipped` : ""}.`,
        });
      }
    } else {
      setResult({ type: "error", message: res.error });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
        style={{
          letterSpacing: "1.5px",
          borderColor: "var(--color-neutral-600)",
          color: "var(--color-neutral-300)",
          background: "transparent",
        }}
      >
        <Search size={12} strokeWidth={1.5} aria-hidden />
        {running ? "Researching…" : "Run Research"}
      </button>
      {result && (
        <span
          className="font-[family-name:var(--font-body)] text-[12px]"
          style={{
            color:
              result.type === "error"
                ? "var(--color-brand-red)"
                : "var(--color-neutral-400)",
          }}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
