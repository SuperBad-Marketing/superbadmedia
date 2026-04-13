"use client";

/**
 * ReflectionClient — free-form reflection UI (section 5 only).
 *
 * Prominent Skip affordance. Text area auto-resizes.
 * Motion: form fades in with houseSpring.
 *
 * Owner: BDA-2.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface ReflectionClientProps {
  profileId: string;
  submitAction: (formData: FormData) => Promise<void>;
}

export function ReflectionClient({
  profileId,
  submitAction,
}: ReflectionClientProps) {
  const [pending, setPending] = React.useState(false);
  const [text, setText] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await submitAction(fd);
    setPending(false);
  }

  async function handleSkip() {
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("reflection", "");
    await submitAction(fd);
    setPending(false);
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      className="flex flex-col items-center justify-center min-h-dvh px-6 py-16 gap-8 max-w-xl mx-auto"
    >
      <div className="text-center">
        <p
          className="text-xs tracking-widest uppercase mb-4"
          style={{ color: "var(--color-neutral-500, #6b7280)" }}
        >
          Before the reveal
        </p>
        <h2
          className="text-2xl font-semibold leading-snug"
          style={{ color: "var(--color-neutral-50, #fafafa)" }}
        >
          Anything you want to add?
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--color-neutral-400, #9ca3af)" }}
        >
          Optional. This goes into your portrait alongside your answers.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 w-full max-w-md"
      >
        <input type="hidden" name="profileId" value={profileId} />

        <textarea
          name="reflection"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="What did this bring up? What did you notice? What's missing from the picture so far?"
          disabled={pending}
          style={{
            background: "rgba(255,255,255,0.05)",
            color: "var(--color-neutral-100, #f5f5f5)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-card, 12px)",
            padding: "1rem",
            fontSize: "0.9375rem",
            lineHeight: 1.6,
            resize: "vertical",
            width: "100%",
            outline: "none",
          }}
        />

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending || text.trim().length === 0}
            style={{
              flex: 1,
              background: "var(--color-brand-primary, #e8ff47)",
              color: "var(--color-neutral-950, #0a0a0a)",
              borderRadius: "var(--radius-button, 8px)",
              padding: "0.75rem 1.25rem",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor:
                pending || text.trim().length === 0 ? "default" : "pointer",
              opacity: pending || text.trim().length === 0 ? 0.5 : 1,
              border: "none",
            }}
          >
            Add to my portrait
          </button>

          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={pending}
            style={{
              padding: "0.75rem 1.25rem",
              background: "transparent",
              color: "var(--color-neutral-500, #6b7280)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "var(--radius-button, 8px)",
              fontSize: "0.875rem",
              cursor: pending ? "default" : "pointer",
            }}
          >
            Skip
          </button>
        </div>
      </form>
    </motion.main>
  );
}
