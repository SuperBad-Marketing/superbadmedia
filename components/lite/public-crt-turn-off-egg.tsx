"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { neutral } from "@/lib/design-tokens";

type Phase = "idle" | "dim" | "static" | "collapse" | "frozen";
type ActivePhase = Exclude<Phase, "idle">;

const DIM_MS = 400;
const STATIC_MS = 180;
const COLLAPSE_MS = 600;
const COOKIE_NAME = "sb_crt_closed";

function setCrtClosedCookie(): void {
  const melbourneNow = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    hour: "2-digit",
    hour12: false,
  });
  const currentHour = parseInt(melbourneNow, 10);
  const hoursUntil7am = currentHour < 7 ? 7 - currentHour : 24 - currentHour + 7;
  const maxAge = hoursUntil7am * 3600;
  document.cookie = `${COOKIE_NAME}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function PublicCrtTurnOffEgg() {
  const [phase, setPhase] = useState<Phase>("idle");

  const handleFired = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.eggId !== "public_crt_turn_off") return;
    setPhase("dim");
    setCrtClosedCookie();
  }, []);

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleFired);
    return () => window.removeEventListener("public-egg-fired", handleFired);
  }, [handleFired]);

  useEffect(() => {
    if (phase === "idle" || phase === "frozen") return;

    let ms = 0;
    let next: Phase = "idle";

    if (phase === "dim") { ms = DIM_MS; next = "static"; }
    else if (phase === "static") { ms = STATIC_MS; next = "collapse"; }
    else if (phase === "collapse") { ms = COLLAPSE_MS; next = "frozen"; }

    if (!ms) return;

    const timer = setTimeout(() => setPhase(next), ms);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;

  return (
    <AnimatePresence>
      <PublicCrtActive key="public-crt-active" phase={phase as ActivePhase} />
    </AnimatePresence>
  );
}

function PublicCrtActive({ phase }: { phase: ActivePhase }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] select-none"
      style={{ cursor: "default" }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ backgroundColor: neutral[950] }}
        initial={{ opacity: 0 }}
        animate={{
          opacity:
            phase === "dim"
              ? 0.7
              : phase === "static"
                ? 0.85
                : 1,
        }}
        transition={{ duration: DIM_MS / 1000, ease: "easeOut" }}
      />

      {(phase === "static" || phase === "collapse" || phase === "frozen") && (
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "static" ? 0.15 : 0 }}
          transition={{ duration: STATIC_MS / 1000 }}
        >
          <PublicCrtStatic />
        </motion.div>
      )}

      {(phase === "collapse" || phase === "frozen") && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-full"
            style={{
              backgroundColor: neutral[100],
              boxShadow: `0 0 40px 12px ${neutral[100]}40, 0 0 80px 24px ${neutral[100]}20`,
            }}
            initial={{ height: "100vh", opacity: 0.9 }}
            animate={{
              height: phase === "frozen" ? "0px" : "2px",
              opacity: phase === "frozen" ? 0 : 1,
            }}
            transition={{
              duration: COLLAPSE_MS / 1000,
              ease: [0.4, 0, 0.2, 1],
            }}
          />
        </div>
      )}

      {phase === "frozen" && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-12"
          style={{ backgroundColor: neutral[950] }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <p
            className="max-w-md px-6 text-center font-serif text-lg leading-relaxed italic"
            style={{ color: neutral[300] }}
          >
            we&rsquo;ve closed for the night. go to bed.
            <br />
            the site will reopen at 7am melbourne time, whether you like it or not.
          </p>

          <p
            className="text-xs tracking-widest uppercase"
            style={{ color: neutral[500] }}
          >
            close this tab.
          </p>
        </motion.div>
      )}

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.03) 2px,
            rgba(0,0,0,0.03) 4px
          )`,
          mixBlendMode: "multiply",
        }}
      />
    </motion.div>
  );
}

function PublicCrtStatic() {
  return (
    <svg
      className="h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "contrast(1.5) brightness(0.8)" }}
    >
      <filter id="public-crt-noise">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="4"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#public-crt-noise)" opacity="0.6" />
    </svg>
  );
}
