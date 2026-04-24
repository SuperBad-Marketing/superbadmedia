"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitStructuredBriefAction } from "../actions";

const HOUSE_SPRING = {
  type: "spring" as const,
  mass: 1,
  stiffness: 220,
  damping: 25,
};

const BRIEF_KINDS = [
  { value: "shoot", label: "Shoot" },
  { value: "edit", label: "Edit" },
  { value: "shoot_and_edit", label: "Shoot + Edit" },
];

const BUDGET_RANGES = [
  { value: "", label: "Select range…" },
  { value: "under_1k", label: "Under $1,000" },
  { value: "1k_3k", label: "$1,000 – $3,000" },
  { value: "3k_5k", label: "$3,000 – $5,000" },
  { value: "5k_10k", label: "$5,000 – $10,000" },
  { value: "10k_plus", label: "$10,000+" },
];

export function StructuredBriefForm() {
  const [form, setForm] = React.useState({
    businessName: "",
    contactName: "",
    contactEmail: "",
    description: "",
    deliveryDate: "",
    projectTitle: "",
    briefKind: "",
    styleReferences: "",
    keyMessages: "",
    targetAudience: "",
    deliverablesBreakdown: "",
    locationDetails: "",
    talentNotes: "",
    budgetRange: "",
    additionalNotes: "",
  });
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0.02 } : HOUSE_SPRING;

  const canSubmit =
    form.businessName.trim() &&
    form.contactName.trim() &&
    form.contactEmail.trim() &&
    form.description.trim() &&
    form.deliveryDate;

  function set(field: keyof typeof form) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await submitStructuredBriefAction({
        ...form,
        deliveryDateMs: new Date(form.deliveryDate).getTime(),
      });
      if (res.ok) {
        setSubmitted(res.referenceNumber);
      } else {
        toast.error(res.error);
      }
    });
  }

  const showShootFields =
    form.briefKind === "shoot" || form.briefKind === "shoot_and_edit";

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
          . We&apos;ll review everything and get back to you.
        </p>
        <p className="mt-2 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
          the details make the difference.
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
      {/* ── Core fields ── */}
      <SectionLabel>Your details</SectionLabel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" required>
          <Input value={form.businessName} onChange={set("businessName")} placeholder="Coastal Brew Co" />
        </Field>
        <Field label="Your name" required>
          <Input value={form.contactName} onChange={set("contactName")} placeholder="Sam Brewster" />
        </Field>
      </div>

      <Field label="Email" required>
        <Input type="email" value={form.contactEmail} onChange={set("contactEmail")} placeholder="sam@coastalbrew.com.au" />
      </Field>

      {/* ── Project details ── */}
      <SectionLabel>Project</SectionLabel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project title">
          <Input value={form.projectTitle} onChange={set("projectTitle")} placeholder="Winter menu launch" />
        </Field>
        <Field label="Brief type">
          <select
            value={form.briefKind}
            onChange={set("briefKind")}
            className="w-full rounded-[8px] border border-[color:rgba(253,245,230,0.08)] bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none transition-colors duration-[180ms] focus:border-[color:var(--color-brand-pink)]"
          >
            <option value="">Select type…</option>
            {BRIEF_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="What do you need?" required>
        <Textarea value={form.description} onChange={set("description")} placeholder="Describe the project at a high level — what are we making and why?" rows={3} />
      </Field>

      <Field label="Key messages">
        <Textarea value={form.keyMessages} onChange={set("keyMessages")} placeholder="What must come through in the final piece?" rows={2} />
      </Field>

      <Field label="Target audience">
        <Textarea value={form.targetAudience} onChange={set("targetAudience")} placeholder="Who is this for? Age, interests, where they hang out online." rows={2} />
      </Field>

      <Field label="Deliverables breakdown">
        <Textarea value={form.deliverablesBreakdown} onChange={set("deliverablesBreakdown")} placeholder="e.g. 3x 30s reels, 1x 60s hero, 5x still frames" rows={2} />
      </Field>

      <Field label="Style references">
        <Textarea value={form.styleReferences} onChange={set("styleReferences")} placeholder="Links, descriptions, mood boards — anything that shows the vibe." rows={2} />
      </Field>

      {/* ── Shoot-specific fields ── */}
      {showShootFields && (
        <>
          <SectionLabel>Shoot details</SectionLabel>
          <Field label="Location">
            <Textarea value={form.locationDetails} onChange={set("locationDetails")} placeholder="Address, access notes, parking, power availability." rows={2} />
          </Field>
          <Field label="Talent / on-screen">
            <Textarea value={form.talentNotes} onChange={set("talentNotes")} placeholder="Who's on camera? Staff, actors, product only?" rows={2} />
          </Field>
        </>
      )}

      {/* ── Budget & delivery ── */}
      <SectionLabel>Budget & delivery</SectionLabel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget range">
          <select
            value={form.budgetRange}
            onChange={set("budgetRange")}
            className="w-full rounded-[8px] border border-[color:rgba(253,245,230,0.08)] bg-transparent px-3 py-2 font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-cream)] outline-none transition-colors duration-[180ms] focus:border-[color:var(--color-brand-pink)]"
          >
            {BUDGET_RANGES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Delivery date" required>
          <Input type="date" value={form.deliveryDate} onChange={set("deliveryDate")} min={new Date().toISOString().split("T")[0]} />
        </Field>
      </div>

      <Field label="Additional notes">
        <Textarea value={form.additionalNotes} onChange={set("additionalNotes")} placeholder="Anything else we should know." rows={2} />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <Link
          href="/brief/lean"
          className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-pink)]"
        >
          Just need a quick brief?
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pt-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-600)]"
      style={{ letterSpacing: "2px", borderTop: "1px solid rgba(253, 245, 230, 0.05)" }}
    >
      {children}
    </div>
  );
}
