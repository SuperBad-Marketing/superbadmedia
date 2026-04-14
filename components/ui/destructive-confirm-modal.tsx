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

/**
 * Generic confirm modal for high-stakes destructive actions.
 * Two modes:
 *   - `simple`: cancel + confirm button.
 *   - `type-to-confirm`: confirm button disabled until the user types
 *     `confirmPhrase` verbatim (case-sensitive, trimmed on both sides).
 *
 * Spec: sales-pipeline.md §7.2. Also used by the Loss Reason modal and
 * any future destructive flow (e.g. Won drag-out in Client Management).
 */
export type DestructiveConfirmMode =
  | { kind: "simple" }
  | { kind: "type-to-confirm"; confirmPhrase: string };

export function DestructiveConfirmModal({
  open,
  onOpenChange,
  mode,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "destructive",
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: DestructiveConfirmMode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
  pending?: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  const [typed, setTyped] = React.useState("");

  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const canConfirm =
    !pending &&
    (mode.kind === "simple" || typed.trim() === mode.confirmPhrase.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {children}

        {mode.kind === "type-to-confirm" ? (
          <div className="grid gap-2">
            <Label htmlFor="destructive-confirm-phrase" className="text-xs">
              Type{" "}
              <span className="font-mono font-semibold">
                {mode.confirmPhrase}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="destructive-confirm-phrase"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
