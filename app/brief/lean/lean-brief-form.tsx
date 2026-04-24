"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitLeanBriefAction } from "../actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

export function LeanBriefForm() {
  const [businessName, setBusinessName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState("");
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  const canSubmit =
    businessName.trim() &&
    contactName.trim() &&
    contactEmail.trim() &&
    description.trim() &&
    deliveryDate;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await submitLeanBriefAction({
        businessName,
        contactName,
        contactEmail,
        description,
        deliveryDateMs: new Date(deliveryDate).getTime(),
      });
      if (res.ok) {
        setSubmitted(res.referenceNumber);
      } else {
        toast.error(res.error);
      }
    });
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition}
        className="rounded-[16px] px-8 py-10 text-center"
        style={{
          background: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <CheckCircle2
          className="mx-auto size-10 text-[color:var(--color-success)]"
          strokeWidth={1.5}
        />
        <h2
          className="mt-4 font-[family-name:var(--font-display)] text-[24px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.2px" }}
        >
          Brief received.
        </h2>
        <p className="mt-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.55] text-[color:var(--color-neutral-400)]">
          Your reference number is{" "}
          <span className="font-[family-name:var(--font-label)] text-[color:var(--color-brand-cream)]">
            {submitted}
          </span>
          . We&apos;ll be in touch.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          one brief closer to something great.
        </p>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[16px] px-6 py-6"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
      }}
    >
      <Field label="Business name" required>
        <Input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Coastal Brew Co"
        />
      </Field>

      <Field label="Your name" required>
        <Input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Sam Brewster"
        />
      </Field>

      <Field label="Email" required>
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="sam@coastalbrew.com.au"
        />
      </Field>

      <Field label="What do you need?" required>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="30-second reel for Instagram, showcasing our new winter menu. Moody lighting, close-up food shots, voiceover optional."
          rows={4}
        />
      </Field>

      <Field label="Delivery date" required>
        <Input
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/brief/structured"
          className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)]"
        >
          Need a detailed brief?
        </Link>
        <button
          type="submit"
          disabled={isPending || !canSubmit}
          className="cursor-pointer rounded-[8px] border-none px-5 py-2.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px disabled:opacity-40"
          style={{
            letterSpacing: "1.8px",
            background: "var(--color-brand-red)",
            boxShadow:
              "inset 0 1px 0 rgba(253, 245, 230, 0.04), 0 4px 12px rgba(178, 40, 72, 0.25)",
          }}
        >
          {isPending ? "Submitting…" : "Submit brief"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="mb-1.5 block font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  );
}
