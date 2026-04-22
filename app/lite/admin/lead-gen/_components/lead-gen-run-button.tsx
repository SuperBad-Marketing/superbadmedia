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
          return {
            ok: true,
            message: `Search complete — ${result.candidatesCreated} candidate${result.candidatesCreated === 1 ? "" : "s"} found.`,
          };
        }
        return { ok: false, error: result.error };
      }}
    />
  );
}
