"use client";

/**
 * Onboarding credential creation — client component.
 *
 * Shows the pre-filled email and a single "Confirm" button. On submit,
 * fires the server action to create the user record + send a magic link.
 * Success state shows a "Check your email" message.
 *
 * Spec: onboarding-and-segmentation.md §6.3 — "Confirm your email address
 * — this is how you'll log in." One field, one confirmation email, one click.
 *
 * Owner: OS-3.
 */
import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { Button } from "@/components/ui/button";
import { sendCredentialEmail } from "./actions";

interface CredentialsClientProps {
  email: string;
  contactId: string;
  companyId: string;
  firstName: string;
}

export default function CredentialsClient({
  email,
  contactId,
  companyId,
  firstName,
}: CredentialsClientProps) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const shouldReduceMotion = useReducedMotion();

  const transition = shouldReduceMotion
    ? ({ duration: 0.18, ease: "linear" } as const)
    : houseSpring;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await sendCredentialEmail({ contactId, companyId });
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="flex flex-col items-center gap-6 text-center"
      >
        <h2 className="font-heading text-2xl text-foreground">
          Check your email
        </h2>
        <p className="max-w-md text-muted-foreground">
          We sent a login link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click
          it to confirm your email and log in. The link expires in 7 days.
        </p>
        <p className="text-sm text-muted-foreground/70">
          Didn&apos;t get it? Check your spam folder, or visit the portal to
          request a new link.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="flex flex-col items-center gap-6 text-center"
    >
      <h2 className="font-heading text-2xl text-foreground">
        One last thing, {firstName}
      </h2>
      <p className="max-w-md text-muted-foreground">
        Confirm your email address — this is how you&apos;ll log in from now
        on.
      </p>
      <div className="rounded-lg border border-border bg-surface-secondary px-6 py-4">
        <p className="text-lg font-medium text-foreground">{email}</p>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={isPending}
      >
        {isPending ? "Sending…" : "Confirm and send login link"}
      </Button>
    </motion.div>
  );
}
