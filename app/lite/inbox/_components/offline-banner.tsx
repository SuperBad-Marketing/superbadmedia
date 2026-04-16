"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";

/**
 * Top-of-screen offline indicator (spec §4.5 Offline + §4.6 voice
 * sprinkle). Watches `online`/`offline` window events and slides a band
 * in with the house spring. Reduced-motion downgrades to a fade.
 *
 * Copy is short and reassuring — §11 voice: "Offline — changes will
 * sync when you're back." Matches the outbound queue architecture in
 * `lib/offline/inbox-cache.ts`.
 */
export function OfflineBanner() {
  const reducedMotion = useReducedMotion();
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline-banner"
          role="status"
          aria-live="polite"
          initial={reducedMotion ? { opacity: 0 } : { y: -32, opacity: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { y: -32, opacity: 0 }}
          transition={reducedMotion ? { duration: 0.18 } : houseSpring}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2",
            "bg-[color:var(--color-brand-pink)]/15 text-[color:var(--color-brand-pink)]",
            "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
          )}
        >
          <WifiOff size={12} strokeWidth={1.75} aria-hidden />
          <span>Offline — changes will sync when you&rsquo;re back.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
