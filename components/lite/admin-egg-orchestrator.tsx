"use client";

import { useEffect } from "react";
import { useAdminEggs } from "@/lib/eggs/use-admin-eggs";

/**
 * Mounts in the admin layout. On session load, evaluates egg triggers
 * server-side and dispatches a custom event if one fires.
 *
 * Egg rendering is handled by dedicated components that listen for the
 * `admin-egg-fired` custom event on `window`.
 */
export function AdminEggOrchestrator() {
  const egg = useAdminEggs();

  useEffect(() => {
    if (!egg) return;
    window.dispatchEvent(
      new CustomEvent("admin-egg-fired", {
        detail: { eggId: egg.eggId, fireId: egg.fireId, evidence: egg.evidence },
      }),
    );
  }, [egg]);

  return null;
}
