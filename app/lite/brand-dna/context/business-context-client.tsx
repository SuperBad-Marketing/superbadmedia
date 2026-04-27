"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { houseSpring } from "@/lib/design-tokens";

interface BusinessContextClientProps {
  profileId: string;
  submitAction: (formData: FormData) => Promise<void>;
}

const FIELDS = [
  {
    name: "businessDoes",
    label: "What does the business do?",
    placeholder: "e.g. Specialty coffee roaster in Brunswick",
    maxLength: 200,
  },
  {
    name: "customers",
    label: "Who are your customers?",
    placeholder: "e.g. Cafes and home brewers who care about origin",
    maxLength: 200,
  },
  {
    name: "differentiator",
    label: "What makes you different from competitors?",
    placeholder: "e.g. We roast to order, single-origin, direct trade only",
    maxLength: 200,
  },
] as const;

export function BusinessContextClient({
  profileId,
  submitAction,
}: BusinessContextClientProps) {
  const [values, setValues] = React.useState({
    businessDoes: "",
    customers: "",
    differentiator: "",
  });
  const [pending, setPending] = React.useState(false);

  const allFilled = values.businessDoes.trim().length > 0
    && values.customers.trim().length > 0
    && values.differentiator.trim().length > 0;

  async function handleSubmit() {
    if (pending || !allFilled) return;
    setPending(true);

    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("businessDoes", values.businessDoes.trim());
    fd.set("customers", values.customers.trim());
    fd.set("differentiator", values.differentiator.trim());

    await submitAction(fd);
    setPending(false);
  }

  return (
    <main
      className="bda-context-main"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, duration: 0.9 }}
        className="bda-context-inner"
        style={{
          maxWidth: 640,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 40,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <span>Quick context</span>
          <span
            aria-hidden="true"
            style={{ flex: 1, height: 1, background: "rgba(244, 160, 176, 0.2)" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1
            className="bda-context-heading"
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1.25,
              color: "var(--brand-cream)",
              letterSpacing: "-0.5px",
              margin: 0,
            }}
          >
            Tell us about the business.
          </h1>
          <p
            style={{
              fontSize: 14,
              fontStyle: "italic",
              color: "var(--neutral-500)",
              margin: 0,
            }}
          >
            One line each. This shapes everything that comes after.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {FIELDS.map((field) => (
            <div key={field.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label
                htmlFor={field.name}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  fontWeight: 500,
                  color: "var(--brand-cream)",
                }}
              >
                {field.label}
              </label>
              <input
                id={field.name}
                type="text"
                value={values[field.name as keyof typeof values]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                }
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                disabled={pending}
                autoComplete="off"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  lineHeight: 1.5,
                  color: "var(--brand-cream)",
                  background: "rgba(34, 34, 31, 0.5)",
                  border: "1px solid rgba(253, 245, 230, 0.08)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  outline: "none",
                  transition: "border-color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(244, 160, 176, 0.3)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(253, 245, 230, 0.08)";
                }}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={pending || !allFilled}
          className="bda-context-continue"
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 11,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: allFilled ? "var(--brand-cream)" : "var(--neutral-600)",
            background: allFilled ? "var(--brand-red)" : "rgba(34, 34, 31, 0.5)",
            border: "1px solid",
            borderColor: allFilled ? "var(--brand-red)" : "rgba(253, 245, 230, 0.08)",
            borderRadius: 12,
            padding: "16px 32px",
            cursor: pending || !allFilled ? "default" : "pointer",
            opacity: pending ? 0.6 : 1,
            transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            alignSelf: "flex-start",
          }}
        >
          {pending ? "Saving…" : "Continue"}
        </button>
      </motion.div>

      <style jsx>{`
        .bda-context-continue:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 20px rgba(178, 40, 72, 0.3);
        }
        @media (max-width: 640px) {
          .bda-context-main {
            padding: 20px !important;
          }
          :global(.bda-context-inner) {
            gap: 24px !important;
          }
          :global(.bda-context-heading) {
            font-size: 24px !important;
          }
        }
      `}</style>
    </main>
  );
}
