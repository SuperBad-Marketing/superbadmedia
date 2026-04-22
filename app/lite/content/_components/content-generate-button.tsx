"use client";

import { ManualRunButton } from "@/components/lite/manual-run-button";
import { triggerContentGenerateAction } from "../actions";

export function ContentGenerateButton() {
  return (
    <ManualRunButton
      label="Generate now"
      pendingLabel="Generating…"
      onRun={async () => {
        const result = await triggerContentGenerateAction();
        if (result.ok) {
          return { ok: true, message: "Post generated and ready for review." };
        }
        return { ok: false, error: result.error };
      }}
    />
  );
}
