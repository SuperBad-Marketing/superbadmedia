"use client";

import { useState, useCallback, useTransition } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface ReferralFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    email: string;
    note: string;
  }) => Promise<void>;
}

export function ReferralForm({ open, onClose, onSubmit }: ReferralFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shouldReduceMotion = useReducedMotion();

  const reset = useCallback(() => {
    setName("");
    setEmail("");
    setNote("");
    setSubmitted(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(reset, 300);
  }, [onClose, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedName = name.trim();
      const trimmedEmail = email.trim().toLowerCase();

      if (!trimmedName) {
        setError("Name is required.");
        return;
      }
      if (!trimmedEmail || !trimmedEmail.includes("@")) {
        setError("A valid email is required.");
        return;
      }

      setError(null);
      startTransition(async () => {
        try {
          await onSubmit({
            name: trimmedName,
            email: trimmedEmail,
            note: note.trim(),
          });
          setSubmitted(true);
        } catch {
          setError("Something went wrong. Try again.");
        }
      });
    },
    [name, email, note, onSubmit],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
          }
          className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(26,26,24,0.88)] backdrop-blur-[16px] sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={
              shouldReduceMotion ? {} : { opacity: 0, y: 40, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={shouldReduceMotion ? { duration: 0 } : houseSpring}
            className="w-full max-w-[440px] rounded-t-2xl border border-[rgba(253,245,230,0.08)] bg-[var(--color-surface-1)] p-6 pb-8 sm:rounded-2xl sm:p-8"
          >
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(244,160,176,0.15)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-brand-pink)"
                    strokeWidth={2}
                    className="h-6 w-6"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <p className="font-[family-name:var(--font-playfair-display)] text-lg text-[var(--color-brand-cream)]">
                  sent it through. we&apos;ll take it from here.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-2 rounded-lg border border-[rgba(253,245,230,0.12)] bg-transparent px-5 py-2.5 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[2px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:border-[var(--color-brand-pink)]"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h2 className="font-[family-name:var(--font-black-han-sans)] text-[22px] leading-none text-[var(--color-brand-cream)] sm:text-[26px]">
                      Know someone?
                    </h2>
                    <p className="mt-1.5 text-[13px] italic text-[var(--color-neutral-500)]">
                      no pressure. just a name and an email.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-md border border-[rgba(253,245,230,0.15)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)] transition-colors duration-200 hover:border-[var(--color-brand-pink)] hover:text-[var(--color-brand-cream)]"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                      Their name
                    </span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sarah Chen"
                      autoFocus
                      className="rounded-lg border border-[rgba(253,245,230,0.1)] bg-[var(--color-surface-0)] px-3.5 py-2.5 text-[15px] text-[var(--color-brand-cream)] placeholder:text-[var(--color-neutral-600)] focus:border-[var(--color-brand-pink)] focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                      Their email
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@example.com"
                      className="rounded-lg border border-[rgba(253,245,230,0.1)] bg-[var(--color-surface-0)] px-3.5 py-2.5 text-[15px] text-[var(--color-brand-cream)] placeholder:text-[var(--color-neutral-600)] focus:border-[var(--color-brand-pink)] focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                      Anything we should know?
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="she just opened a second location…"
                      rows={3}
                      className="resize-none rounded-lg border border-[rgba(253,245,230,0.1)] bg-[var(--color-surface-0)] px-3.5 py-2.5 text-[15px] text-[var(--color-brand-cream)] placeholder:text-[var(--color-neutral-600)] focus:border-[var(--color-brand-pink)] focus:outline-none"
                    />
                  </label>

                  {error && (
                    <p className="text-[13px] text-[var(--color-brand-red)]">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="mt-1 rounded-lg bg-[var(--color-brand-red)] px-5 py-3 font-[family-name:var(--font-righteous)] text-[12px] uppercase tracking-[2px] text-[var(--color-brand-cream)] shadow-[0_8px_24px_rgba(178,40,72,0.3)] transition-all duration-300 hover:translate-y-[-1px] hover:shadow-[0_12px_32px_rgba(178,40,72,0.4)] disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isPending ? "Sending…" : "Send it through"}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
