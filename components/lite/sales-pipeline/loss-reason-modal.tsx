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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEAL_LOSS_REASONS,
  type DealLossReason,
} from "@/lib/db/schema/deals";

/**
 * Closed list of 7 reasons per spec §3.5. `other` requires free-text
 * notes; the remaining six accept optional notes (kept as null when blank).
 */
const LOSS_LABELS: Record<DealLossReason, string> = {
  price: "Price",
  timing: "Timing",
  went_with_someone_else: "Went with someone else",
  not_a_fit: "Not a fit",
  ghosted: "Ghosted",
  internal_change: "Internal change",
  other: "Other",
};

export function LossReasonModal({
  open,
  onOpenChange,
  companyName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  companyName: string;
  pending: boolean;
  onConfirm: (payload: {
    loss_reason: DealLossReason;
    loss_notes: string | null;
  }) => void;
}) {
  const [reason, setReason] = React.useState<DealLossReason | null>(null);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setReason(null);
      setNotes("");
    }
  }, [open]);

  const otherNotesRequired = reason === "other" && notes.trim().length === 0;
  const canConfirm = !pending && reason !== null && !otherNotesRequired;

  function submit() {
    if (!canConfirm || reason === null) return;
    onConfirm({
      loss_reason: reason,
      loss_notes: notes.trim().length > 0 ? notes.trim() : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {companyName} as Lost?</DialogTitle>
          <DialogDescription>
            Pick a reason. This powers the loss-pattern analytics in the
            Cockpit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <RadioGroup
            value={reason ?? ""}
            onValueChange={(v) => setReason(v as DealLossReason)}
            className="grid-cols-1 gap-1"
          >
            {DEAL_LOSS_REASONS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5"
              >
                <RadioGroupItem value={key} />
                <span>{LOSS_LABELS[key]}</span>
              </label>
            ))}
          </RadioGroup>

          <div className="grid gap-1.5">
            <Label htmlFor="loss-notes" className="text-xs">
              Notes{" "}
              {reason === "other" ? (
                <span className="text-destructive">(required)</span>
              ) : (
                <span className="text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Textarea
              id="loss-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                reason === "other"
                  ? "What happened? Short is fine."
                  : "Anything worth remembering."
              }
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
            variant="destructive"
            onClick={submit}
            disabled={!canConfirm}
          >
            Mark as Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
