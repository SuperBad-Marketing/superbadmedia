"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { triggerManualRun } from "./actions";

export function RunNowButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await triggerManualRun();
      if (result.ok) {
        toast.success("Run started — check back in a minute");
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="shrink-0 rounded-[8px] px-4 py-2 font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-brand-cream)] transition-transform duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        letterSpacing: "1.8px",
        background: "var(--color-brand-red)",
        boxShadow:
          "inset 0 1px 0 rgba(253,245,230,0.08), 0 4px 12px rgba(178,40,72,0.25)",
      }}
    >
      {isPending ? "Starting…" : "Run now"}
    </button>
  );
}
