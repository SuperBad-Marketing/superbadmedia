"use client";

import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface BrandDnaGateProps {
  portalToken: string;
  contactFirstName: string;
}

export function BrandDnaGate({
  portalToken,
  contactFirstName,
}: BrandDnaGateProps) {
  const shouldReduceMotion = useReducedMotion();

  const fadeUp = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: houseSpring,
      };

  const stagger = (i: number) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { ...houseSpring, delay: 0.15 + i * 0.08 },
        };

  const LOCKED_SECTIONS = [
    { label: "Chat", eyebrow: "Home" },
    { label: "Invoices", eyebrow: "Finance" },
    { label: "Deliverables", eyebrow: "Your work" },
    { label: "Package", eyebrow: "Your plan" },
    { label: "Messages", eyebrow: "Comms" },
    { label: "Data Export", eyebrow: "Privacy" },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-80px)] flex-col items-center justify-center px-6 py-12">
      <motion.div
        {...fadeUp}
        className="flex max-w-md flex-col items-center gap-8 text-center"
      >
        {/* Lock icon */}
        <div className="grid h-16 w-16 place-items-center rounded-full border border-[rgba(253,245,230,0.08)] bg-[rgba(253,245,230,0.04)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-7 w-7 text-[var(--color-brand-orange)]"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-3">
          <p className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
            one thing first
          </p>
          <h1 className="font-[family-name:var(--font-black-han-sans)] text-[28px] leading-[1.1] text-[var(--color-foreground)] sm:text-[32px] md:text-[40px]">
            Brand DNA
          </h1>
          <p className="font-[family-name:var(--font-playfair-display)] text-[18px] italic leading-[1.4] text-[var(--color-neutral-300)]">
            {contactFirstName}, before we unlock the rest of your room — we need
            to understand your brand. takes about ten minutes.
          </p>
        </div>

        {/* CTA */}
        <a
          href={`/lite/portal/brand-dna?token=${portalToken}`}
          className="rounded-full bg-[var(--color-brand-red)] px-8 py-3 font-[family-name:var(--font-righteous)] text-[11px] uppercase tracking-[1.5px] text-[var(--color-brand-cream)] transition-transform duration-200 hover:scale-[1.04]"
        >
          Complete your Brand DNA
        </a>
      </motion.div>

      {/* Blurred section previews */}
      <motion.div
        {...(shouldReduceMotion
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              transition: { ...houseSpring, delay: 0.3 },
            })}
        className="mt-12 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {LOCKED_SECTIONS.map((section, i) => (
          <motion.div
            key={section.label}
            {...stagger(i)}
            className="flex flex-col gap-1 rounded-xl border border-[rgba(253,245,230,0.04)] bg-[rgba(253,245,230,0.02)] px-4 py-3 opacity-40 blur-[1px]"
          >
            <span className="font-[family-name:var(--font-righteous)] text-[8px] uppercase tracking-[1.5px] text-[var(--color-neutral-500)]">
              {section.eyebrow}
            </span>
            <span className="font-[family-name:var(--font-black-han-sans)] text-[15px] text-[var(--color-foreground)]">
              {section.label}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
