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
import { Textarea } from "@/components/ui/textarea";
import type { AddLeadInput } from "@/app/lite/admin/pipeline/actions";

export function AddLeadModal({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  pending: boolean;
  onSubmit: (input: AddLeadInput) => void;
}) {
  const [companyName, setCompanyName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [contactRole, setContactRole] = React.useState("");
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setContactRole("");
      setNotes("");
    }
  }, [open]);

  const canSubmit = !pending && companyName.trim() !== "" && contactName.trim() !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      companyName,
      contactName,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined,
      contactRole: contactRole || undefined,
      notes: notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a lead</DialogTitle>
          <DialogDescription>
            Minimum: company name and a contact. Everything else is optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="add-lead-company" className="text-xs">
              Company name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-lead-company"
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Pty Ltd"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-lead-contact" className="text-xs">
              Contact name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="add-lead-contact"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Jane Smith"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-lead-email" className="text-xs">
                Email
              </Label>
              <Input
                id="add-lead-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@acme.com"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-lead-phone" className="text-xs">
                Phone
              </Label>
              <Input
                id="add-lead-phone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="0400 000 000"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-lead-role" className="text-xs">
              Role
            </Label>
            <Input
              id="add-lead-role"
              value={contactRole}
              onChange={(e) => setContactRole(e.target.value)}
              placeholder="Owner, Marketing Manager…"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="add-lead-notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="add-lead-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you met, what they need, anything useful."
              rows={2}
            />
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
            <Button type="submit" disabled={!canSubmit}>
              Add lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
