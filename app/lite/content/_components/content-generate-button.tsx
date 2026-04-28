"use client";

import * as React from "react";
import { Play } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import { triggerContentGenerateAction } from "../actions";

interface ContentGenerateButtonProps {
  companyId: string;
}

export function ContentGenerateButton({ companyId }: ContentGenerateButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const toast = useToastWithSound();

  function handleGenerate() {
    startTransition(async () => {
      const result = await triggerContentGenerateAction(companyId);
      if (result.ok) {
        toast("Post generated and ready for review.", { sound: "kanban-drop" });
      } else {
        toast.error(result.error ?? "Generation failed.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-colors disabled:opacity-40 disabled:pointer-events-none"
      style={{
        backgroundColor: "var(--color-brand-red)",
        color: "var(--color-brand-cream)",
        letterSpacing: "1.5px",
      }}
    >
      <Play size={12} strokeWidth={1.5} aria-hidden />
      {pending ? "Generating…" : "Generate"}
    </button>
  );
}
