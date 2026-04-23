"use client";

import { ManualRunButton } from "@/components/lite/manual-run-button";
import { triggerManualRunAction } from "../actions";

export function LeadGenRunButton() {
  return (
    <ManualRunButton
      label="Run now"
      pendingLabel="Running…"
      onRun={async () => {
        const result = await triggerManualRunAction();
        if (result.ok) {
          const parts = [
            `${result.foundCount} discovered`,
            `${result.qualifiedCount} qualified`,
            `${result.candidatesCreated} with email`,
          ];
          if (result.dncFilteredCount > 0) {
            parts.push(`${result.dncFilteredCount} DNC-blocked`);
          }
          if (result.cappedReason) {
            parts.push(`capped: ${result.cappedReason}`);
          }
          return {
            ok: true,
            message: `Search complete — ${parts.join(" → ")}.`,
          };
        }
        return { ok: false, error: result.error };
      }}
    />
  );
}
