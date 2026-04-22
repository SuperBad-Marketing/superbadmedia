"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";

export function ManualRunButton({
  label,
  pendingLabel,
  onRun,
}: {
  label: string;
  pendingLabel: string;
  onRun: () => Promise<{ ok: boolean; message?: string; error?: string }>;
}) {
  const [pending, startTransition] = React.useTransition();
  const toast = useToastWithSound();

  function handleClick() {
    startTransition(async () => {
      const result = await onRun();
      if (result.ok) {
        toast(result.message ?? "Done.", { sound: "kanban-drop" });
      } else {
        toast.error(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-neutral-600)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
    >
      <Play size={12} strokeWidth={1.5} aria-hidden />
      {pending ? pendingLabel : label}
    </button>
  );
}
