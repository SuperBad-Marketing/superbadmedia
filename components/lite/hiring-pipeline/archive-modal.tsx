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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CandidateStage } from "@/lib/db/schema/candidates";
import { ARCHIVE_REASONS_BY_STAGE } from "@/lib/hiring/stages";

const DISPOSITION_DIRECTIONS = [
  { value: "we_archived", label: "We archived them" },
  { value: "they_withdrew", label: "They withdrew" },
  { value: "mutual", label: "Mutual" },
] as const;

type DispositionDirection = (typeof DISPOSITION_DIRECTIONS)[number]["value"];

const REASON_LABELS: Record<string, string> = {
  not_my_taste: "Not my taste",
  role_already_filled: "Role already filled",
  already_in_system: "Already in the system",
  rate_off: "Rate's off",
  not_available: "Not available when we need them",
  portfolio_didnt_land: "Portfolio didn't land",
  wrong_city: "Wrong city",
  they_went_quiet: "They went quiet",
  trial_didnt_land: "Trial didn't land",
  didnt_deliver: "Didn't deliver",
  communication_fell_apart: "Communication fell apart",
  rate_moved: "Rate moved on us",
  not_producing: "Not producing anymore",
  booked_up_elsewhere: "Booked up elsewhere",
  compliance_issue: "Compliance issue",
  clean_parting: "Clean parting",
  they_moved_on: "They moved on",
  other: "Other",
};

const REASON_DEFAULT_DISPOSITION: Record<string, DispositionDirection> = {
  not_my_taste: "we_archived",
  role_already_filled: "we_archived",
  already_in_system: "we_archived",
  rate_off: "mutual",
  not_available: "they_withdrew",
  portfolio_didnt_land: "we_archived",
  wrong_city: "we_archived",
  they_went_quiet: "they_withdrew",
  trial_didnt_land: "we_archived",
  didnt_deliver: "we_archived",
  communication_fell_apart: "mutual",
  rate_moved: "they_withdrew",
  not_producing: "we_archived",
  booked_up_elsewhere: "they_withdrew",
  compliance_issue: "we_archived",
  clean_parting: "mutual",
  they_moved_on: "they_withdrew",
  other: "we_archived",
};

export interface ArchiveResult {
  reason_code: string;
  reason_free_text: string | null;
  reflection_text: string | null;
  disposition_direction: DispositionDirection;
}

export function ArchiveModal({
  open,
  onOpenChange,
  candidateName,
  fromStage,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  candidateName: string;
  fromStage: CandidateStage;
  pending: boolean;
  onConfirm: (result: ArchiveResult) => void;
}) {
  const [reason, setReason] = React.useState("");
  const [freeText, setFreeText] = React.useState("");
  const [reflection, setReflection] = React.useState("");
  const [disposition, setDisposition] = React.useState<DispositionDirection>("we_archived");

  React.useEffect(() => {
    if (!open) {
      setReason("");
      setFreeText("");
      setReflection("");
      setDisposition("we_archived");
    }
  }, [open]);

  const reasons = ARCHIVE_REASONS_BY_STAGE[fromStage] ?? [];
  const isOther = reason === "other";
  const freeTextValid = !isOther || freeText.trim().length >= 10;
  const canConfirm = !pending && reason !== "" && freeTextValid;

  const handleReasonChange = (code: string) => {
    setReason(code);
    const defaultDisp = REASON_DEFAULT_DISPOSITION[code];
    if (defaultDisp) setDisposition(defaultDisp);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {candidateName}</DialogTitle>
          <DialogDescription>
            Pick a reason. This one goes on the record.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-xs">Reason</Label>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleReasonChange(code)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                    reason === code
                      ? "border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-cream)]"
                      : "border-[color:var(--color-neutral-600)]/60 text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-400)]"
                  }`}
                >
                  {REASON_LABELS[code] ?? code}
                </button>
              ))}
            </div>
          </div>

          {isOther ? (
            <div className="grid gap-2">
              <Label htmlFor="archive-free-text" className="text-xs">
                Tell us more (min 10 chars)
              </Label>
              <Textarea
                id="archive-free-text"
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                rows={2}
                maxLength={500}
                autoFocus
              />
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label className="text-xs">Who pulled the plug?</Label>
            <div className="flex gap-2">
              {DISPOSITION_DIRECTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDisposition(d.value)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] transition-colors ${
                    disposition === d.value
                      ? "border-[color:var(--color-brand-pink)] bg-[color:var(--color-brand-pink)]/10 text-[color:var(--color-brand-cream)]"
                      : "border-[color:var(--color-neutral-600)]/60 text-[color:var(--color-neutral-400)] hover:border-[color:var(--color-neutral-400)]"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="archive-reflection" className="text-xs">
              What would you tell the Role Brief about this? (optional)
            </Label>
            <Textarea
              id="archive-reflection"
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Helps future scouting."
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
            onClick={() =>
              onConfirm({
                reason_code: reason,
                reason_free_text: isOther ? freeText.trim() : null,
                reflection_text:
                  reflection.trim().length > 0 ? reflection.trim() : null,
                disposition_direction: disposition,
              })
            }
            disabled={!canConfirm}
          >
            Archive
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
