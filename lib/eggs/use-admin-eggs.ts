"use client";

import { useEffect, useRef, useState } from "react";

export interface AdminEggFired {
  eggId: string;
  fireId: string | null;
  evidence: Record<string, unknown> | null;
}

export function useAdminEggs(): AdminEggFired | null {
  const [fired, setFired] = useState<AdminEggFired | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const controller = new AbortController();

    fetch("/api/lite/eggs/evaluate", {
      method: "POST",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.fired) {
          setFired({ eggId: data.eggId, fireId: data.fireId ?? null, evidence: data.evidence });
        }
      })
      .catch(() => {
        // Silent fail — eggs are non-critical
      });

    return () => {
      controller.abort();
    };
  }, []);

  return fired;
}
