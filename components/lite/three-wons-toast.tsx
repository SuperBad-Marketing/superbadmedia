"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring, neutral, brand } from "@/lib/design-tokens";

type Phase = "idle" | "showing" | "exiting";

const DISPLAY_MS = 4000;

export function ThreeWonsToast() {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleEggFired = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.eggId !== "three_wons") return;
    setPhase("showing");
  }, []);

  useEffect(() => {
    window.addEventListener("admin-egg-fired", handleEggFired);
    return () => window.removeEventListener("admin-egg-fired", handleEggFired);
  }, [handleEggFired]);

  useEffect(() => {
    if (phase !== "showing") return;
    const timer = setTimeout(() => setPhase("exiting"), DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <AnimatePresence onExitComplete={() => setPhase("idle")}>
      {phase !== "idle" && (
        <motion.div
          key="three-wons"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={houseSpring}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            className="rounded-xl px-6 py-4 shadow-2xl"
            style={{
              backgroundColor: neutral[800],
              border: `1px solid ${neutral[700]}`,
              boxShadow: `0 0 40px ${brand.red}22`,
            }}
          >
            <p
              className="font-[family-name:var(--font-serif)] text-base italic leading-relaxed"
              style={{ color: neutral[100] }}
            >
              That&rsquo;s three. Either you&rsquo;re crushing it or it&rsquo;s a slow Tuesday.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
