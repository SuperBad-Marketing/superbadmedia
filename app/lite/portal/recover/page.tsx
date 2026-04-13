/**
 * Portal magic-link recovery form.
 *
 * Shown to portal visitors whose session cookie has expired or is missing.
 * The visitor enters their email; if matched, a fresh OTT is issued and
 * sent via `sendEmail()` (classification `portal_magic_link_recovery`).
 * If the email isn't found, a neutral "we sent it if you're on file" message
 * renders — no enumeration of contact existence.
 *
 * Motion: form ↔ success state animated with `houseSpring` via AnimatePresence
 * (G5 requirement).
 *
 * Owner: A8.
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

type FormState = "idle" | "submitting" | "sent" | "error";

export default function PortalRecoverPage() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/portal/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok && res.status !== 200) {
        throw new Error("Request failed");
      }

      setFormState("sent");
    } catch {
      setFormState("error");
      setErrorMsg("Something went wrong. Please try again.");
    }
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "24rem" }}>
        <AnimatePresence mode="wait">
          {formState !== "sent" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={houseSpring}
            >
              <h1
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: "0.5rem",
                }}
              >
                Access your portal
              </h1>
              <p
                style={{
                  color: "#555",
                  fontSize: "0.875rem",
                  marginBottom: "1.5rem",
                }}
              >
                Enter your email and we&apos;ll send you a fresh access link.
              </p>

              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
              >
                <label
                  style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "#777",
                    }}
                  >
                    Email address
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    disabled={formState === "submitting"}
                    style={{
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #ddd",
                      borderRadius: "0.375rem",
                      fontSize: "1rem",
                      outline: "none",
                    }}
                  />
                </label>

                {formState === "error" && errorMsg && (
                  <p role="alert" style={{ color: "#c00", fontSize: "0.875rem" }}>
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={formState === "submitting"}
                  style={{
                    padding: "0.75rem",
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    borderRadius: "0.375rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: formState === "submitting" ? "wait" : "pointer",
                    opacity: formState === "submitting" ? 0.6 : 1,
                  }}
                >
                  {formState === "submitting" ? "Sending…" : "Send access link"}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={houseSpring}
              style={{ textAlign: "center" }}
            >
              <h1
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: "0.75rem",
                }}
              >
                Check your inbox
              </h1>
              <p style={{ color: "#555", fontSize: "0.875rem" }}>
                If that email is on file, you&apos;ll receive an access link
                shortly. The link is valid for 7 days and works once.
              </p>
              <p
                style={{
                  marginTop: "2rem",
                  fontSize: "0.8rem",
                  color: "#aaa",
                }}
              >
                Can&apos;t find it?{" "}
                <a
                  href="mailto:andy@superbadmedia.com.au"
                  style={{ color: "inherit", textDecoration: "underline" }}
                >
                  Email Andy directly.
                </a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
