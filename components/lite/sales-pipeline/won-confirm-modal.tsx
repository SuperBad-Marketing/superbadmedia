"use client";

import * as React from "react";

import { DestructiveConfirmModal } from "@/components/ui/destructive-confirm-modal";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  DEAL_WON_OUTCOMES,
  type DealWonOutcome,
} from "@/lib/db/schema/deals";
import type { CompanyBillingMode } from "@/lib/db/schema/companies";

const OUTCOME_LABELS: Record<DealWonOutcome, string> = {
  retainer: "Retainer",
  saas: "SaaS subscription",
  project: "One-off project",
};

/**
 * Manual Won transition — confirms the `won_outcome` and, for Stripe-billed
 * companies, requires typing the company name (spec §3.3, §5.5).
 * Stripe-billed Wons should normally arrive via webhook (SP-7); this flow
 * exists as an override valve, hence the type-to-confirm safety check.
 */
export function WonConfirmModal({
  open,
  onOpenChange,
  companyName,
  billingMode,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  companyName: string;
  billingMode: CompanyBillingMode;
  pending: boolean;
  onConfirm: (payload: { won_outcome: DealWonOutcome }) => void;
}) {
  const [outcome, setOutcome] = React.useState<DealWonOutcome>("retainer");

  React.useEffect(() => {
    if (!open) setOutcome("retainer");
  }, [open]);

  const isStripe = billingMode === "stripe";

  return (
    <DestructiveConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Mark ${companyName} as Won?`}
      description={
        isStripe
          ? "This company is Stripe-billed — Won normally arrives via payment webhook. Type the company name to confirm a manual override."
          : "This company is manually billed. Confirm the outcome below."
      }
      confirmLabel="Mark as Won"
      confirmVariant="default"
      mode={
        isStripe
          ? { kind: "type-to-confirm", confirmPhrase: companyName }
          : { kind: "simple" }
      }
      pending={pending}
      onConfirm={() => onConfirm({ won_outcome: outcome })}
    >
      <div className="grid gap-2">
        <Label className="text-xs">Outcome</Label>
        <RadioGroup
          value={outcome}
          onValueChange={(v) => setOutcome(v as DealWonOutcome)}
          className="grid-cols-1 gap-1"
        >
          {DEAL_WON_OUTCOMES.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5"
            >
              <RadioGroupItem value={key} />
              <span>{OUTCOME_LABELS[key]}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </DestructiveConfirmModal>
  );
}
