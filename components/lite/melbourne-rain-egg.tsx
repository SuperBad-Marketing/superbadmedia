"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { neutral } from "@/lib/design-tokens";

const RAIN_VOLUME = 0.04;

export function MelbourneRainEgg() {
  const [visible, setVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFired = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.eggId !== "melbourne_rain") return;
    setVisible(true);

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    try {
      const audio = new Audio("/sounds/rain-ambient.mp3");
      audio.loop = true;
      audio.volume = 0;
      audioRef.current = audio;

      audio.play().then(() => {
        let vol = 0;
        const fadeIn = setInterval(() => {
          vol = Math.min(vol + 0.005, RAIN_VOLUME);
          audio.volume = vol;
          if (vol >= RAIN_VOLUME) clearInterval(fadeIn);
        }, 100);
      }).catch(() => {
        // Autoplay blocked — silently skip sound
      });
    } catch {
      // Audio unavailable
    }
  }, []);

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleFired);
    return () => {
      window.removeEventListener("public-egg-fired", handleFired);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [handleFired]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="egg-note-melbourne-rain"
          className="fixed bottom-24 left-0 right-0 z-40 pointer-events-none flex justify-center px-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <p
            className="pointer-events-auto max-w-lg text-center font-serif text-sm leading-relaxed italic"
            style={{ color: neutral[500] }}
          >
            raining in Melbourne. we&rsquo;re glad you&rsquo;re inside.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
