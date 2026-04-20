"use client";

import * as React from "react";

import {
  DestructiveConfirmModal,
} from "@/components/ui/destructive-confirm-modal";

export function BenchConfirmModal({
  open,
  onOpenChange,
  candidateName,
  complianceOk,
  complianceMissing,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidateName: string;
  complianceOk: boolean;
  complianceMissing: string[];
  pending: boolean;
  onConfirm: () => void;
}) {
  if (!complianceOk) {
    return (
      <DestructiveConfirmModal
        open={open}
        onOpenChange={onOpenChange}
        mode={{ kind: "simple" }}
        title={`Can't bench ${candidateName} yet`}
        description="Compliance gate isn't clear. Complete onboarding first."
        confirmLabel="Got it"
        confirmVariant="outline"
        pending={false}
        onConfirm={() => onOpenChange(false)}
      >
        <div className="text-[13px] text-[color:var(--color-neutral-400)]">
          <p className="mb-2">Missing:</p>
          <ul className="list-inside list-disc space-y-1 text-[color:var(--color-brand-pink)]">
            {complianceMissing.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      </DestructiveConfirmModal>
    );
  }

  return (
    <DestructiveConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      mode={{ kind: "type-to-confirm", confirmPhrase: candidateName }}
      title={`Move ${candidateName} to Bench`}
      description="This commits them to the active roster. Type their name to confirm."
      confirmLabel="Move to Bench"
      confirmVariant="default"
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}
