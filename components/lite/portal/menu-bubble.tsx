"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import type { PortalMode } from "@/lib/portal/mode";
import { ReferralForm } from "./referral-form";

interface MenuSection {
  key: string;
  label: string;
  eyebrow: string;
  description: string;
  preRetainer: boolean;
}

interface MenuBubbleProps {
  portalToken: string;
  portalMode: PortalMode;
  sections: MenuSection[];
  currentSection: string;
  hasNewDeliverables?: boolean;
  onReferralSubmit?: (data: {
    name: string;
    email: string;
    note: string;
  }) => Promise<void>;
}

export function MenuBubble({
  portalToken,
  portalMode,
  sections,
  currentSection,
  hasNewDeliverables,
  onReferralSubmit,
}: MenuBubbleProps) {
  const [open, setOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleNavigate = useCallback(
    (key: string) => {
      setOpen(false);
      if (key === "chat") {
        window.location.href = `/lite/portal/${portalToken}`;
      } else if (key === "brand-dna") {
        window.location.href = `/lite/portal/brand-dna`;
      } else {
        window.location.href = `/lite/portal/${portalToken}/${key}`;
      }
    },
    [portalToken],
  );

  const handleReferralClick = useCallback(() => {
    setOpen(false);
    setReferralOpen(true);
  }, []);

  return (
    <>
      {/* Menu bubble — fixed bottom-right */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed bottom-5 right-5 z-20 flex h-[46px] items-center gap-2 rounded-full border-none bg-[var(--color-brand-red)] px-4 pl-3.5 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[2px] text-[var(--color-brand-cream)] shadow-[0_12px_40px_rgba(178,40,72,0.35),inset_0_1px_0_rgba(253,245,230,0.12)] transition-transform duration-[400ms] [animation:breathe_3.6s_cubic-bezier(0.16,1,0.3,1)_infinite] hover:scale-[1.04] hover:translate-y-[-1px] hover:shadow-[0_16px_50px_rgba(178,40,72,0.45),inset_0_1px_0_rgba(253,245,230,0.18)] hover:[animation-play-state:paused] sm:bottom-8 sm:right-8 sm:h-[52px] sm:gap-2.5 sm:px-5 sm:pl-4"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[18px] w-[18px]">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        Menu
      </button>

      {/* Full-page overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-30 flex bg-[rgba(26,26,24,0.92)] backdrop-blur-[24px]"
          >
            {/* Close button */}
            <button
              onClick={() => setOpen(false)}
              className="absolute right-5 top-5 rounded-md border border-[rgba(253,245,230,0.2)] bg-transparent px-3.5 py-2 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[2px] text-[var(--color-brand-cream)] transition-colors duration-200 hover:border-[var(--color-brand-pink)] sm:right-10 sm:top-7"
            >
              Close
            </button>

            <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-5 py-14 sm:gap-10 sm:px-10 sm:py-20">
              {/* Greeting */}
              <p className="max-w-[480px] font-[family-name:var(--font-playfair-display)] text-xl italic text-[var(--color-brand-pink)]">
                everything in its place.
              </p>

              {/* Section grid */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {sections.map((section, i) => {
                  const locked =
                    portalMode === "pre_retainer" && !section.preRetainer;
                  const isCurrent = section.key === currentSection;

                  return (
                    <motion.button
                      key={section.key}
                      initial={
                        shouldReduceMotion
                          ? {}
                          : { opacity: 0, y: 8 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              ...houseSpring,
                              delay: i * 0.05,
                            }
                      }
                      onClick={() => {
                        if (!locked) handleNavigate(section.key);
                      }}
                      disabled={locked}
                      className={`relative flex flex-col gap-1.5 rounded-2xl border px-4 py-5 text-left transition-all duration-300 sm:px-6 sm:py-7 ${
                        locked
                          ? "cursor-not-allowed border-[rgba(253,245,230,0.04)] bg-[rgba(34,34,31,0.3)] opacity-50"
                          : isCurrent
                            ? "cursor-default border-[rgba(244,160,176,0.3)] bg-[rgba(34,34,31,0.9)]"
                            : "cursor-pointer border-[rgba(253,245,230,0.08)] bg-[rgba(34,34,31,0.6)] hover:translate-y-[-2px] hover:border-[rgba(244,160,176,0.3)] hover:bg-[rgba(34,34,31,0.9)]"
                      }`}
                    >
                      <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
                        {section.eyebrow}
                      </span>
                      <span className="font-[family-name:var(--font-black-han-sans)] text-[20px] leading-none text-[var(--color-brand-cream)] sm:text-[26px]">
                        {locked ? (
                          <span className="opacity-40">{section.label}</span>
                        ) : (
                          section.label
                        )}
                      </span>
                      <span className="text-[13px] italic text-[var(--color-neutral-500)]">
                        {locked
                          ? "available on retainer."
                          : section.description}
                      </span>

                      {/* New badge */}
                      {section.key === "deliverables" &&
                        hasNewDeliverables &&
                        !locked && (
                          <span className="absolute right-3.5 top-3.5 rounded bg-[var(--color-brand-pink)] px-2 py-0.5 font-[family-name:var(--font-righteous)] text-[9px] uppercase tracking-[1.5px] text-[var(--color-brand-red)]">
                            New
                          </span>
                        )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Know someone? — standing referral item */}
              <motion.button
                initial={
                  shouldReduceMotion
                    ? {}
                    : { opacity: 0, y: 8 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        ...houseSpring,
                        delay: sections.length * 0.05 + 0.05,
                      }
                }
                onClick={handleReferralClick}
                className="flex w-full items-center gap-3 rounded-xl border border-[rgba(244,160,176,0.15)] bg-[rgba(34,34,31,0.4)] px-4 py-4 text-left transition-all duration-300 hover:translate-y-[-2px] hover:border-[rgba(244,160,176,0.35)] hover:bg-[rgba(34,34,31,0.7)] sm:px-6 sm:py-5"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-brand-pink)"
                  strokeWidth={1.5}
                  className="h-5 w-5 shrink-0"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                <div>
                  <span className="font-[family-name:var(--font-black-han-sans)] text-[16px] leading-none text-[var(--color-brand-cream)] sm:text-[18px]">
                    Know someone?
                  </span>
                  <span className="mt-0.5 block text-[12px] italic text-[var(--color-neutral-500)]">
                    send a name our way
                  </span>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Referral form modal */}
      <ReferralForm
        open={referralOpen}
        onClose={() => setReferralOpen(false)}
        onSubmit={async (data) => {
          if (onReferralSubmit) await onReferralSubmit(data);
        }}
      />
    </>
  );
}
