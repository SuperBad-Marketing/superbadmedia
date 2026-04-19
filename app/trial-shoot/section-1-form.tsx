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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <span
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
          }}
        >
          Step 1 of 4
        </span>
        <h2
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
            lineHeight: 1.15,
            letterSpacing: "-0.5px",
            color: "var(--brand-cream)",
            margin: "12px 0 0",
          }}
        >
          Let&rsquo;s start
        </h2>
        <p
          style={{
            marginTop: 8,
            fontFamily: "var(--font-body)",
            fontSize: 16,
            color: "var(--neutral-300)",
          }}
        >
          Tell us the basics. We&rsquo;ll take it from here.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
      <label style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}>
        <input
          type="checkbox"
          name="smsOptIn"
          defaultChecked
          style={{
            marginTop: 3,
            width: 16,
            height: 16,
            accentColor: "var(--brand-red)",
          }}
        />
        <div>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--brand-cream)",
            }}
          >
            It&rsquo;s okay to text me about my shoot.
          </span>
          <p
            style={{
              marginTop: 4,
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--neutral-500)",
              lineHeight: 1.5,
            }}
          >
            We&rsquo;ll only text about your booking — reminders, changes, that
            sort of thing. You can opt out any time.
          </p>
        </div>
      </label>

      {/* Shape classification */}
      <div>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            color: "var(--brand-cream)",
            marginBottom: 12,
          }}
        >
          Which best describes your business right now?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {SHAPES.map((shape) => (
            <motion.button
              key={shape.value}
              type="button"
              onClick={() => setSelectedShape(shape.value)}
              whileTap={{ scale: 0.98 }}
              transition={houseSpring}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "14px 20px",
                borderRadius: 12,
                border:
                  selectedShape === shape.value
                    ? "1px solid var(--brand-red)"
                    : "1px solid rgba(253,245,230,0.08)",
                background:
                  selectedShape === shape.value
                    ? "var(--brand-red)"
                    : "var(--neutral-800)",
                color:
                  selectedShape === shape.value
                    ? "var(--brand-cream)"
                    : "var(--neutral-300)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                cursor: "pointer",
                boxShadow:
                  selectedShape === shape.value
                    ? "0 4px 16px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)"
                    : "inset 0 1px 0 rgba(253,245,230,0.04)",
                transition:
                  "background 250ms cubic-bezier(0.16,1,0.3,1), border-color 250ms cubic-bezier(0.16,1,0.3,1), box-shadow 250ms cubic-bezier(0.16,1,0.3,1)",
              }}
              onMouseEnter={(e) => {
                if (selectedShape !== shape.value) {
                  e.currentTarget.style.background = "var(--neutral-700)";
                  e.currentTarget.style.borderColor =
                    "rgba(244,160,176,0.3)";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedShape !== shape.value) {
                  e.currentTarget.style.background = "var(--neutral-800)";
                  e.currentTarget.style.borderColor =
                    "rgba(253,245,230,0.08)";
                }
              }}
            >
              {shape.label}
            </motion.button>
          ))}
        </div>
      </div>

      {error && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--brand-red)",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !selectedShape}
        style={{
          width: "100%",
          padding: "16px 24px",
          borderRadius: 10,
          border: "none",
          background: isPending || !selectedShape ? "var(--neutral-700)" : "var(--brand-red)",
          color: "var(--brand-cream)",
          fontFamily: "var(--font-label)",
          fontSize: 12,
          letterSpacing: "2px",
          textTransform: "uppercase",
          cursor: isPending || !selectedShape ? "not-allowed" : "pointer",
          opacity: isPending || !selectedShape ? 0.5 : 1,
          boxShadow:
            isPending || !selectedShape
              ? "none"
              : "0 8px 24px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)",
          transition:
            "transform 280ms cubic-bezier(0.2,0.8,0.2,1.05), box-shadow 280ms cubic-bezier(0.2,0.8,0.2,1.05), opacity 280ms ease",
        }}
        onMouseEnter={(e) => {
          if (!isPending && selectedShape) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow =
              "0 12px 32px rgba(178,40,72,0.4), inset 0 1px 0 rgba(253,245,230,0.15)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          if (!isPending && selectedShape) {
            e.currentTarget.style.boxShadow =
              "0 8px 24px rgba(178,40,72,0.3), inset 0 1px 0 rgba(253,245,230,0.1)";
          }
        }}
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
        style={{
          display: "block",
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "var(--neutral-500)",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 8,
          border: "1px solid rgba(253,245,230,0.08)",
          background: "var(--neutral-800)",
          boxShadow: "inset 0 1px 0 rgba(253,245,230,0.04)",
          fontFamily: "var(--font-body)",
          fontSize: 16,
          color: "var(--brand-cream)",
          outline: "none",
          transition:
            "border-color 250ms cubic-bezier(0.16,1,0.3,1)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(244,160,176,0.4)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(253,245,230,0.08)";
        }}
      />
    </div>
  );
}
