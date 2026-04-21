"use client";

import { useEffect, useRef, useCallback } from "react";
import { nanoid } from "nanoid";
import {
  readPublicEggState,
  writePublicEggState,
  recordVisit,
  recordEggFired,
  getVisitCount,
} from "@/lib/eggs/public-egg-state";

const INITIAL_DELAY_MS = 3_000;
const POLL_INTERVAL_MS = 15_000;
const MAX_POLLS = 20;
const DWELL_START = Date.now();

const EXCLUDED_PATHS = ["/lite/admin", "/lite/portal", "/lite/setup", "/lite/onboarding", "/lite/tasks", "/lite/finance", "/lite/content", "/lite/inbox", "/bench"];

function isPublicPage(): boolean {
  const path = window.location.pathname;
  return !EXCLUDED_PATHS.some((prefix) => path.startsWith(prefix));
}

interface PublicEggFired {
  eggId: string;
  evidence: Record<string, unknown>;
}

export function PublicEggOrchestrator() {
  const sessionIdRef = useRef(nanoid(12));
  const firedRef = useRef(false);
  const pollCountRef = useRef(0);
  const scrollStateRef = useRef({
    maxDepth: 0,
    firstScrollAt: 0,
    lastScrollAt: 0,
  });
  const tabBgRef = useRef({ backgroundedAt: 0, totalBgMs: 0 });

  const handleScroll = useCallback(() => {
    const now = Date.now();
    const depth =
      window.scrollY /
      Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const s = scrollStateRef.current;
    if (!s.firstScrollAt) s.firstScrollAt = now;
    s.lastScrollAt = now;
    if (depth > s.maxDepth) s.maxDepth = depth;
  }, []);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      tabBgRef.current.backgroundedAt = Date.now();
    } else if (tabBgRef.current.backgroundedAt > 0) {
      tabBgRef.current.totalBgMs +=
        Date.now() - tabBgRef.current.backgroundedAt;
      tabBgRef.current.backgroundedAt = 0;
    }
  }, []);

  const evaluate = useCallback(async () => {
    if (firedRef.current) return;
    if (pollCountRef.current >= MAX_POLLS) return;
    if (!isPublicPage()) return;
    pollCountRef.current++;

    let state = readPublicEggState();
    state = recordVisit(state);
    writePublicEggState(state);

    if (state.tricksDisabled) return;

    const now = new Date();
    const s = scrollStateRef.current;
    const scrollDurationMs =
      s.firstScrollAt && s.lastScrollAt
        ? s.lastScrollAt - s.firstScrollAt
        : 0;

    const payload = {
      localHour: now.getHours(),
      dayOfWeek: now.getDay(),
      referrer: document.referrer.slice(0, 2000),
      dwellMs: Date.now() - DWELL_START,
      scrollDepth: Math.min(s.maxDepth, 1),
      scrollDurationMs,
      tabBackgroundedMs: tabBgRef.current.totalBgMs,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      visitCount: getVisitCount(state),
      sessionId: sessionIdRef.current,
      isMobile: window.innerWidth < 768,
      firstEggDeliveredAt: state.firstEggDeliveredAt,
      lastHiddenEggFiredAt: state.lastHiddenEggFiredAt,
      firedEggIds: state.firedEggIds,
      tricksDisabled: state.tricksDisabled,
      sessionFiredEggIds: state.sessionFiredEggIds,
    };

    try {
      const res = await fetch("/api/lite/eggs/evaluate-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        fired: boolean;
        eggId: string | null;
        evidence: Record<string, unknown> | null;
      };

      if (data.fired && data.eggId) {
        firedRef.current = true;
        const updated = recordEggFired(state, data.eggId);
        writePublicEggState(updated);

        window.dispatchEvent(
          new CustomEvent<PublicEggFired>("public-egg-fired", {
            detail: {
              eggId: data.eggId,
              evidence: data.evidence ?? {},
            },
          }),
        );
      }
    } catch {
      // Eggs are non-critical
    }
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const initialTimer = setTimeout(evaluate, INITIAL_DELAY_MS);
    const pollTimer = setInterval(evaluate, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(initialTimer);
      clearInterval(pollTimer);
    };
  }, [evaluate, handleScroll, handleVisibilityChange]);

  return null;
}
