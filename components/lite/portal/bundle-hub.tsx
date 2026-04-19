"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { tier2 } from "@/lib/motion/choreographies";
import { ImageIcon, FileText } from "lucide-react";
import { dismissHub, logHubShown } from "@/app/lite/portal/[token]/hub-actions";

interface BundleHubProps {
  portalToken: string;
  hasGallery: boolean;
  hasPlan: boolean;
}

export function BundleHub({ portalToken, hasGallery, hasPlan }: BundleHubProps) {
  const shouldReduceMotion = useReducedMotion();
  const loggedRef = useRef(false);

  useEffect(() => {
    if (!loggedRef.current) {
      loggedRef.current = true;
      logHubShown();
    }
  }, []);

  const choreography = tier2["bundle-reveal"];
  const motionConfig = shouldReduceMotion ? choreography.reduced : choreography;
  const containerMotion = shouldReduceMotion
    ? choreography.reduced
    : choreography.container;

  async function handleTileClick(target: "gallery" | "plan") {
    await dismissHub(target);
    const path =
      target === "gallery"
        ? `/lite/portal/${portalToken}/gallery`
        : `/lite/portal/${portalToken}/plan`;
    window.location.href = path;
  }

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0.18 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10 text-center"
      >
        <p className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-brand-orange)]">
          your room
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-playfair-display)] text-[28px] italic leading-[1.2] text-[var(--color-foreground)] md:text-[34px]">
          Everything you paid for, together.
        </h1>
      </motion.div>

      <motion.div
        variants={containerMotion?.variants}
        initial="initial"
        animate="animate"
        transition={containerMotion?.transition}
        className="grid w-full max-w-[680px] grid-cols-1 gap-5 md:grid-cols-2"
      >
        {hasGallery && (
          <motion.button
            variants={motionConfig.variants}
            transition={motionConfig.transition}
            onClick={() => handleTileClick("gallery")}
            className="group flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.03)] px-8 py-10 text-center transition-colors duration-300 hover:border-[rgba(244,160,176,0.2)] hover:bg-[rgba(253,245,230,0.05)]"
          >
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(244,160,176,0.1)]">
              <ImageIcon className="h-6 w-6 text-[var(--color-brand-pink)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                media
              </span>
              <span className="font-[family-name:var(--font-bhs)] text-[22px] text-[var(--color-foreground)]">
                Your photos &amp; video
              </span>
              <span className="text-[13px] italic text-[var(--color-neutral-500)]">
                everything from the shoot, ready to download.
              </span>
            </div>
          </motion.button>
        )}

        {hasPlan ? (
          <motion.button
            variants={motionConfig.variants}
            transition={motionConfig.transition}
            onClick={() => handleTileClick("plan")}
            className="group flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-[rgba(253,245,230,0.06)] bg-[rgba(253,245,230,0.03)] px-8 py-10 text-center transition-colors duration-300 hover:border-[rgba(244,160,176,0.2)] hover:bg-[rgba(253,245,230,0.05)]"
          >
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(242,140,82,0.1)]">
              <FileText className="h-6 w-6 text-[var(--color-brand-orange)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                strategy
              </span>
              <span className="font-[family-name:var(--font-bhs)] text-[22px] text-[var(--color-foreground)]">
                Your plan
              </span>
              <span className="text-[13px] italic text-[var(--color-neutral-500)]">
                a bespoke 6-week marketing plan, built for you.
              </span>
            </div>
          </motion.button>
        ) : (
          <motion.div
            variants={motionConfig.variants}
            transition={motionConfig.transition}
            className="flex flex-col items-center gap-5 rounded-[var(--radius-card)] border border-[rgba(253,245,230,0.04)] bg-[rgba(253,245,230,0.02)] px-8 py-10 text-center opacity-60"
          >
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[rgba(242,140,82,0.06)]">
              <FileText className="h-6 w-6 text-[var(--color-neutral-500)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
                strategy
              </span>
              <span className="font-[family-name:var(--font-bhs)] text-[22px] text-[var(--color-neutral-300)]">
                Your plan
              </span>
              <span className="text-[13px] italic text-[var(--color-neutral-500)]" data-ambient-slot="portal_plan_arriving">
                arriving shortly.
              </span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
