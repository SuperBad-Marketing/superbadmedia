"use client";

import * as React from "react";
import { Play, Settings2, X } from "lucide-react";
import { useToastWithSound } from "@/components/lite/toast-with-sound";
import { triggerContentGenerateAction } from "../actions";

interface ContentGenerateButtonProps {
  companies: Array<{ id: string; name: string }>;
}

export function ContentGenerateButton({ companies }: ContentGenerateButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [selectedCompany, setSelectedCompany] = React.useState(
    companies[0]?.id ?? "",
  );
  const toast = useToastWithSound();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await triggerContentGenerateAction(
        selectedCompany || undefined,
      );
      if (result.ok) {
        toast("Post generated and ready for review.", { sound: "kanban-drop" });
        setOpen(false);
      } else {
        toast.error(result.error ?? "Generation failed.");
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--color-neutral-600)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-300)] transition-colors hover:border-[color:var(--color-brand-pink)] hover:text-[color:var(--color-brand-pink)] disabled:opacity-40 disabled:pointer-events-none"
      >
        <Settings2 size={12} strokeWidth={1.5} aria-hidden />
        Generate
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-20 mt-2 w-[320px] rounded-xl p-5"
          style={{
            background: "var(--color-surface-2)",
            boxShadow:
              "var(--surface-highlight), 0 8px 32px rgba(0, 0, 0, 0.4)",
            border: "1px solid rgba(253, 245, 230, 0.08)",
          }}
        >
          <div className="mb-4 flex items-center justify-between">
            <span
              className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "2px" }}
            >
              Generate Post
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-300)]"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="gen-company"
                className="mb-1.5 block font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-400)]"
              >
                Company
              </label>
              {companies.length === 0 ? (
                <p className="text-[12px] italic text-[color:var(--color-neutral-500)]">
                  No companies with content config found.
                </p>
              ) : (
                <select
                  id="gen-company"
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="w-full rounded-lg border border-[rgba(253,245,230,0.08)] bg-[color:var(--color-surface-3)] px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={pending || !selectedCompany}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] transition-colors disabled:opacity-40 disabled:pointer-events-none"
              style={{
                backgroundColor: "var(--color-brand-red)",
                color: "var(--color-brand-cream)",
                letterSpacing: "1.5px",
              }}
            >
              <Play size={12} strokeWidth={1.5} aria-hidden />
              {pending ? "Generating…" : "Generate now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
