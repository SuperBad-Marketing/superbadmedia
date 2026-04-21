"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  readPublicEggState,
  writePublicEggState,
  recordEggFired,
} from "@/lib/eggs/public-egg-state";
import { PublicEggMarginNote } from "./public-egg-margin-note";

const WELCOME_EGG_ID = "welcome_safety_net";

export function WelcomeEggSafetyNet() {
  const hasFiredRef = useRef(false);
  const sessionHadEggRef = useRef(false);

  const handleEggFired = useCallback(() => {
    sessionHadEggRef.current = true;
  }, []);

  const fireWelcome = useCallback(() => {
    if (hasFiredRef.current) return;
    if (sessionHadEggRef.current) return;

    const state = readPublicEggState();
    if (state.firstEggDeliveredAt) return;
    if (state.tricksDisabled) return;

    hasFiredRef.current = true;
    const updated = recordEggFired(state, WELCOME_EGG_ID);
    writePublicEggState(updated);

    window.dispatchEvent(
      new CustomEvent("public-egg-fired", {
        detail: { eggId: WELCOME_EGG_ID, evidence: { reason: "safety_net" } },
      }),
    );
  }, []);

  useEffect(() => {
    window.addEventListener("public-egg-fired", handleEggFired);

    const handleVisibility = () => {
      if (document.hidden) fireWelcome();
    };

    const handleBeforeUnload = () => {
      fireWelcome();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("public-egg-fired", handleEggFired);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [handleEggFired, fireWelcome]);

  return (
    <PublicEggMarginNote eggId={WELCOME_EGG_ID} placement="content">
      you came, you saw, nothing happened. we noticed.
    </PublicEggMarginNote>
  );
}
