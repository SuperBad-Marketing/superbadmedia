"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";
import { submitApplyFormAction, type ApplyInput } from "./actions";

interface RoleBriefOption {
  id: string;
  roleName: string;
}

interface ApplyFormClientProps {
  roleBriefs: RoleBriefOption[];
  rateBands: string[];
}

const AVAILABILITY_OPTIONS = [
  { value: 5, label: "Under 5 hrs/week" },
  { value: 10, label: "5–10 hrs/week" },
  { value: 20, label: "10–20 hrs/week" },
  { value: 30, label: "20+ hrs/week" },
];

export function ApplyFormClient({
  roleBriefs,
  rateBands,
}: ApplyFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [portfolioCount, setPortfolioCount] = useState(1);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const fd = new FormData(e.currentTarget);
    const name = (fd.get("name") as string)?.trim();
    const email = (fd.get("email") as string)?.trim();
    const roleBriefId = (fd.get("roleBriefId") as string) || null;
    const locationCity = (fd.get("locationCity") as string)?.trim();
    const rateExpectationBand = fd.get("rateExpectationBand") as string;
    const availabilityHoursPerWeek = parseInt(
      fd.get("availabilityHoursPerWeek") as string,
      10,
    );
    const availableFromRaw = fd.get("availableFrom") as string;
    const availableFromMs = availableFromRaw
      ? new Date(availableFromRaw).getTime()
      : null;
    const recommendSomeone =
      (fd.get("recommendSomeone") as string)?.trim() || null;

    const portfolioUrls: string[] = [];
    for (let i = 0; i < 3; i++) {
      const url = (fd.get(`portfolioUrl${i}`) as string)?.trim();
      if (url) portfolioUrls.push(url);
    }

    if (
      !name ||
      !email ||
      portfolioUrls.length === 0 ||
      !locationCity ||
      !rateExpectationBand ||
      !availabilityHoursPerWeek
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    const input: ApplyInput = {
      name,
      email,
      roleBriefId: roleBriefId === "general" ? null : roleBriefId,
      portfolioUrls,
      locationCity,
      rateExpectationBand,
      availabilityHoursPerWeek,
      availableFromMs,
      recommendSomeone,
    };

    startTransition(async () => {
      const result = await submitApplyFormAction(input);
      if (result.ok) {
        router.push("/apply/confirmation");
      } else {
        setError(result.reason);
      }
    });
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={houseSpring}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        width: "100%",
        maxWidth: 520,
      }}
    >
      <Field label="Name" required>
        <input name="name" type="text" required style={inputStyle} />
      </Field>

      <Field label="Email" required>
        <input name="email" type="email" required style={inputStyle} />
      </Field>

      <Field label="Role" required>
        <select name="roleBriefId" required style={inputStyle}>
          <option value="">Select a role…</option>
          {roleBriefs.map((rb) => (
            <option key={rb.id} value={rb.id}>
              {rb.roleName}
            </option>
          ))}
          <option value="general">Other / general interest</option>
        </select>
      </Field>

      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <Label text="Portfolio" required />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: portfolioCount }).map((_, i) => (
            <input
              key={i}
              name={`portfolioUrl${i}`}
              type="url"
              placeholder={i === 0 ? "https://…" : "Another link (optional)"}
              required={i === 0}
              style={inputStyle}
            />
          ))}
          {portfolioCount < 3 && (
            <button
              type="button"
              onClick={() => setPortfolioCount((c) => c + 1)}
              style={addLinkStyle}
            >
              + add another link
            </button>
          )}
        </div>
      </fieldset>

      <Field label="City" required>
        <input
          name="locationCity"
          type="text"
          placeholder="Melbourne"
          required
          style={inputStyle}
        />
      </Field>

      <Field label="Rate expectation" required>
        <select name="rateExpectationBand" required style={inputStyle}>
          <option value="">Select a range…</option>
          {rateBands.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Availability" required>
        <select
          name="availabilityHoursPerWeek"
          required
          style={inputStyle}
        >
          <option value="">Select…</option>
          {AVAILABILITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Earliest start date">
        <input name="availableFrom" type="date" style={inputStyle} />
      </Field>

      <Field label="Know someone who'd be good?">
        <textarea
          name="recommendSomeone"
          placeholder="Drop a portfolio link and we'll take a look."
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              color: "var(--brand-red)",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              margin: 0,
            }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        type="submit"
        disabled={isPending}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={houseSpring}
        style={{
          background: "var(--brand-red)",
          color: "var(--brand-cream)",
          fontFamily: "var(--font-label)",
          fontSize: 11,
          letterSpacing: "2px",
          textTransform: "uppercase",
          border: "none",
          borderRadius: 8,
          padding: "16px 32px",
          cursor: isPending ? "wait" : "pointer",
          opacity: isPending ? 0.6 : 1,
          marginTop: 8,
        }}
      >
        {isPending ? "Submitting…" : "Apply"}
      </motion.button>
    </motion.form>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label text={label} required={required} />
      {children}
    </label>
  );
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-label)",
        fontSize: 10,
        letterSpacing: "3px",
        textTransform: "uppercase",
        color: "var(--brand-pink)",
      }}
    >
      {text}
      {required && " *"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--brand-cream)",
  background: "var(--neutral-800)",
  border: "1px solid var(--neutral-600)",
  borderRadius: 8,
  padding: "12px 16px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const addLinkStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--brand-pink)",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
  textAlign: "left",
};
