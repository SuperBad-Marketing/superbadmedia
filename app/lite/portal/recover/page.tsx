/**
 * Portal magic-link recovery form.
 *
 * Rendered when the portal guard detects a missing or expired session cookie.
 * One field: email address. On submit:
 *   1. Server Action looks up the contact by email.
 *   2. If found, issues a fresh OTT via issueMagicLink() and sends it.
 *   3. Renders a neutral "check your inbox" confirmation — same for match
 *      or no-match to avoid email enumeration.
 *
 * Motion: form transitions use houseSpring (G5). Reduced-motion parity:
 * AnimatePresence with `initial={false}` and CSS opacity fallback.
 *
 * Owner: A8.
 */
"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { requestPortalLink } from "./actions";

const houseSpring = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

export default function PortalRecoverPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await requestPortalLink(email);
      setSubmitted(true);
    });
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        fontFamily: "var(--font-body, sans-serif)",
        padding: "2rem",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!submitted ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={houseSpring}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              width: "100%",
              maxWidth: "24rem",
            }}
          >
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              Get back to your portal
            </h1>
            <p style={{ color: "var(--color-neutral-500, #6b7280)", fontSize: "0.9rem" }}>
              Enter the email address you used to book your shoot and
              we&apos;ll send you a fresh access link.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                style={{
                  padding: "0.625rem 0.75rem",
                  border: "1px solid var(--color-neutral-200, #e5e7eb)",
                  borderRadius: "var(--radius-md, 0.375rem)",
                  fontSize: "1rem",
                  width: "100%",
                  boxSizing: "border-box",
                }}
                aria-label="Email address"
              />
              <button
                type="submit"
                disabled={isPending || !email}
                style={{
                  padding: "0.625rem 1rem",
                  background: "var(--color-brand-500, #111827)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md, 0.375rem)",
                  fontSize: "0.9rem",
                  cursor: isPending ? "wait" : "pointer",
                  opacity: isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Sending…" : "Send me a link"}
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={houseSpring}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              maxWidth: "24rem",
              textAlign: "center",
            }}
            role="status"
            aria-live="polite"
          >
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              Check your inbox
            </h1>
            <p style={{ color: "var(--color-neutral-500, #6b7280)", fontSize: "0.9rem" }}>
              If that email is on file, a fresh access link is on its way.
              The link is valid for 7 days.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
