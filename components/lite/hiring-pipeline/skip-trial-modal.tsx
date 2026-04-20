"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SKIP_TRIAL_REASONS, type SkipTrialReason } from "@/lib/hiring/stages";

const REASON_LABELS: Record<SkipTrialReason, string> = {
  prior_relationship: "Prior relationship",
  strong_referral: "Strong referral",
  immediate_need: "Immediate need",
};

export function SkipTrialModal({
  open,
  onOpenChange,
  candidateName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidateName: string;
  pending: boolean;
  onConfirm: (reason: SkipTrialReason) => void;
}) {
  const [typed, setTyped] = React.useState("");
  const [reason, setReason] = React.useState<SkipTrialReason | "">("");

  React.useEffect(() => {
    if (!open) {
      setTyped("");
      setReason("");
    }
  }, [open]);

  const canConfirm =
    !pending &&
    reason !== "" &&
    typed.trim() === candidateName.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skip trial for {candidateName}</DialogTitle>
          <DialogDescription>
            Straight to Bench. Pick a reason and type their name to confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-xs">Why skip?</Label>
            <div className="flex flex-wrap gap-1.5">
              {SKIP_TRIAL_REASONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setReason(code)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                    reason === code
                      ? "border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-cream)]"
                      : "border-[color:var(--color-neutral-600)]/60 text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-400)]"
                  }`}
                >
                  {REASON_LABELS[code]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="skip-trial-confirm" className="text-xs">
              Type{" "}
              <span className="font-mono font-semibold">{candidateName}</span>{" "}
              to confirm
            </Label>
            <Input
              id="skip-trial-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(reason as SkipTrialReason)}
            disabled={!canConfirm}
          >
            Skip to Bench
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
