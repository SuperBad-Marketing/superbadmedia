"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { submitSection1Action, type Section1Input } from "./actions";

const SHAPES = [
  { value: "solo_founder" as const, label: "It's just me" },
  { value: "founder_led_team" as const, label: "I run it with a small team" },
  {
    value: "multi_stakeholder_company" as const,
    label: "There are a few decision-makers involved",
  },
];

interface Section1FormProps {
  onSuccess: (token: string) => void;
}

export function Section1Form({ onSuccess }: Section1FormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedShape, setSelectedShape] = useState<
    Section1Input["shape"] | null
  >(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = (fd.get("name") as string)?.trim();
    const businessName = (fd.get("businessName") as string)?.trim();
    const email = (fd.get("email") as string)?.trim();
    const phone = (fd.get("phone") as string)?.trim();
    const smsOptIn = fd.get("smsOptIn") === "on";

    if (!name || !businessName || !email || !phone || !selectedShape) {
      setError("Please fill in all fields.");
      return;
    }

    startTransition(async () => {
      const result = await submitSection1Action({
        name,
        businessName,
        email,
        phone,
        smsOptIn,
        shape: selectedShape,
      });
      if (result.ok) {
        onSuccess(result.token);
      } else {
        setError(result.reason);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="font-[family-name:var(--font-label)] text-[14px] uppercase tracking-[0.15em] text-[color:var(--color-brand-cream)]">
          LET&rsquo;S START
        </h2>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-neutral-300)]">
          Tell us the basics. We&rsquo;ll take it from here.
        </p>
      </div>

      <div className="space-y-5">
        <Field
          name="name"
          label="Your name"
          placeholder="What should we call you?"
          type="text"
          required
        />
        <Field
          name="businessName"
          label="Your business"
          placeholder="The name on the door."
          type="text"
          required
        />
        <Field
          name="email"
          label="Email"
          placeholder="Where we'll send your portal login."
          type="email"
          required
        />
        <Field
          name="phone"
          label="Phone"
          placeholder="For day-of coordination. We won't cold call you."
          type="tel"
          required
        />
      </div>

      {/* SMS opt-in */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="smsOptIn"
          defaultChecked
          className="mt-0.5 h-4 w-4 rounded border-[color:var(--color-neutral-600)] bg-[color:var(--color-neutral-800)] accent-[color:var(--color-brand-red)]"
        />
        <div>
          <span className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
            It&rsquo;s okay to text me about my shoot.
          </span>
          <p className="mt-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
            We&rsquo;ll only text about your booking — reminders, changes, that
            sort of thing. You can opt out any time.
          </p>
        </div>
      </label>

      {/* Shape classification */}
      <div className="space-y-3">
        <p className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
          Which best describes your business right now?
        </p>
        <div className="space-y-2">
          {SHAPES.map((shape) => (
            <motion.button
              key={shape.value}
              type="button"
              onClick={() => setSelectedShape(shape.value)}
              whileTap={{ scale: 0.98 }}
              transition={houseSpring}
              className={`w-full rounded-lg px-4 py-3 text-left font-[family-name:var(--font-body)] text-[15px] transition-colors ${
                selectedShape === shape.value
                  ? "bg-[color:var(--color-brand-red)] text-[color:var(--color-brand-cream)]"
                  : "bg-[color:var(--color-neutral-800)] text-[color:var(--color-neutral-300)] hover:bg-[color:var(--color-neutral-700)]"
              }`}
            >
              {shape.label}
            </motion.button>
          ))}
        </div>
      </div>

      {error && (
        <p className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-red)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !selectedShape}
        className="w-full rounded-lg bg-[color:var(--color-brand-red)] px-6 py-3.5 font-[family-name:var(--font-body)] text-[16px] font-medium text-[color:var(--color-brand-cream)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:hover:brightness-100"
      >
        {isPending ? "One moment…" : "Next"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  type,
  required,
}: {
  name: string;
  label: string;
  placeholder: string;
  type: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-800)] px-3.5 py-2.5 font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)] placeholder:text-[color:var(--color-neutral-500)] focus:border-[color:var(--color-brand-red)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-brand-red)]"
      />
    </div>
  );
}
