"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { neutral } from "@/lib/design-tokens";

export function MelbourneHolidayEgg() {
  const [active, setActive] = useState(false);
  const [holidayName, setHolidayName] = useState<string | null>(null);

  const handleFired = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.eggId !== "melbourne_public_holiday") return;
    setHolidayName(
      (detail.evidence?.holidayName as string) ?? "public holiday",
    );
    setActive(true);
  }, []);

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleFired);
    return () => window.removeEventListener("public-egg-fired", handleFired);
  }, [handleFired]);

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="holiday-takeover"
        className="fixed inset-0 z-[9998] flex flex-col items-center justify-center"
        style={{ backgroundColor: neutral[900] }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.p
          className="max-w-md px-6 text-center font-serif text-lg leading-relaxed italic"
          style={{ color: neutral[300] }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          australian public holiday. we&rsquo;re not working. neither should you.
        </motion.p>

        {holidayName && (
          <motion.p
            className="mt-8 text-xs tracking-widest uppercase"
            style={{ color: neutral[500] }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 1.0, ease: "easeOut" }}
          >
            {holidayName}
          </motion.p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
