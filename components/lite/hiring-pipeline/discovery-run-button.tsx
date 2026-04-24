"use client";

import { ManualRunButton } from "@/components/lite/manual-run-button";
import { runDiscoveryNowAction } from "@/app/lite/admin/hiring/actions";

export function DiscoveryRunButton({ roleBriefId }: { roleBriefId?: string }) {
  return (
    <ManualRunButton
      label="Run discovery"
      pendingLabel="Scouting…"
      onRun={async () => {
        const result = await runDiscoveryNowAction(roleBriefId);
        if (result.ok) {
          return {
            ok: true,
            message: `Found ${result.candidatesFound} candidate${result.candidatesFound === 1 ? "" : "s"} across ${result.briefsProcessed} brief${result.briefsProcessed === 1 ? "" : "s"}.`,
          };
        }
        return { ok: false, error: result.error };
      }}
    />
  );
}
