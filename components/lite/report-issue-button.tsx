"use client";

/**
 * ReportIssueButton — global "Report an issue" footer button.
 *
 * Renders on every admin page via app/layout.tsx. Opens a Dialog where
 * the user can optionally describe the issue before submitting.
 *
 * Motion: form ↔ success transition uses `houseSpring` + AnimatePresence.
 * Reduced-motion parity: AnimatePresence initial={false} degrades without
 * breaking layout.
 *
 * Owner: B1.
 */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FlagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { houseSpring } from "@/lib/design-tokens";
import { reportIssue } from "@/lib/support/reportIssue";

type FormState = "idle" | "submitting" | "success" | "error";

export function ReportIssueButton({ surface }: { surface?: string }) {
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [formState, setFormState] = React.useState<FormState>("idle");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset on close
      setTimeout(() => {
        setDescription("");
        setFormState("idle");
      }, 200);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormState("submitting");

    try {
      await reportIssue({
        surface: surface ?? "unknown",
        pageUrl:
          typeof window !== "undefined" ? window.location.href : "unknown",
        description: description.trim() || undefined,
      });
      setFormState("success");
    } catch {
      setFormState("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" />
        }
      >
        <FlagIcon />
        Report an issue
      </DialogTrigger>

      <DialogContent>
        <AnimatePresence mode="wait" initial={false}>
          {formState !== "success" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={houseSpring}
            >
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Report an issue</DialogTitle>
                  <DialogDescription>
                    Tell us what went wrong and we&apos;ll look into it.
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the issue (optional)"
                    rows={4}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
                    disabled={formState === "submitting"}
                  />
                  {formState === "error" && (
                    <p className="mt-2 text-xs text-destructive">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </div>

                <DialogFooter showCloseButton>
                  <Button
                    type="submit"
                    disabled={formState === "submitting"}
                    size="sm"
                  >
                    {formState === "submitting" ? "Sending…" : "Send report"}
                  </Button>
                </DialogFooter>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={houseSpring}
              className="py-6 text-center"
            >
              <p className="font-heading text-base font-medium">Thanks — got it.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;ll look into it shortly.
              </p>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                >
                  Close
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
