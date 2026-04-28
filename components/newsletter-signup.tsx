"use client";

import { useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

interface NewsletterSignupProps {
  /** Controls visual treatment */
  variant: "inline" | "end-of-post" | "standalone";
  /** Tracked as consent_source in the subscriber record */
  source?: "blog_cta" | "embed_form";
  /** Override the headline */
  headline?: string;
  /** Override the subtext */
  subtext?: string;
}

export function NewsletterSignup({
  variant,
  source = "blog_cta",
  headline,
  subtext,
}: NewsletterSignupProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = inputRef.current?.value.trim();
    if (!email) return;

    setStatus("sending");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  const defaults = getDefaults(variant);
  const displayHeadline = headline ?? defaults.headline;
  const displaySubtext = subtext ?? defaults.subtext;

  if (status === "done") {
    return (
      <SignupShell variant={variant}>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ textAlign: "center" }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: variant === "inline" ? "clamp(18px, 2.5vw, 24px)" : "clamp(22px, 3vw, 32px)",
              lineHeight: 1.1,
              color: "var(--neutral-100)",
              margin: 0,
            }}
          >
            You&rsquo;re in<span style={{ color: "var(--brand-red)" }}>.</span>
          </p>
          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: variant === "inline" ? "13px" : "14px",
              color: "var(--brand-pink)",
              marginTop: 8,
            }}
          >
            first one&rsquo;s on the way.
          </p>
        </motion.div>
      </SignupShell>
    );
  }

  return (
    <SignupShell variant={variant}>
      <div style={{ textAlign: variant === "inline" ? "left" : "center" }}>
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontSize: variant === "inline"
              ? "clamp(16px, 2vw, 20px)"
              : "clamp(20px, 2.5vw, 28px)",
            lineHeight: 1.15,
            color: "var(--neutral-100)",
            margin: 0,
          }}
        >
          {displayHeadline}
          <span style={{ color: "var(--brand-red)" }}>.</span>
        </p>

        {displaySubtext && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: variant === "inline" ? "13px" : "14px",
              color: "var(--neutral-400)",
              marginTop: variant === "inline" ? 6 : 10,
              maxWidth: variant === "inline" ? undefined : "38ch",
              marginInline: variant === "inline" ? undefined : "auto",
            }}
          >
            {displaySubtext}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: 8,
            marginTop: variant === "inline" ? 12 : 16,
            maxWidth: 380,
            marginInline: variant === "inline" ? undefined : "auto",
          }}
        >
          <input
            ref={inputRef}
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            aria-label="Email address"
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--brand-cream, #FDF5E6)",
              backgroundColor: "transparent",
              border: "1px solid var(--neutral-700)",
              borderRadius: 4,
              padding: "10px 14px",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--neutral-500)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--neutral-700)";
            }}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--brand-cream, #FDF5E6)",
              backgroundColor: "var(--brand-red)",
              border: "none",
              borderRadius: 4,
              padding: "10px 20px",
              cursor: status === "sending" ? "wait" : "pointer",
              opacity: status === "sending" ? 0.6 : 1,
              transition: "opacity 0.2s",
              whiteSpace: "nowrap",
            }}
          >
            {status === "sending" ? "..." : "Subscribe"}
          </button>
        </form>

        {status === "error" && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--brand-red)",
              marginTop: 8,
            }}
          >
            Something went wrong. Try again.
          </p>
        )}

        <p
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "12px",
            color: "var(--brand-pink)",
            marginTop: variant === "inline" ? 8 : 12,
            opacity: 0.7,
          }}
        >
          no spam. unsubscribe anytime.
        </p>
      </div>
    </SignupShell>
  );
}

function SignupShell({
  variant,
  children,
}: {
  variant: "inline" | "end-of-post" | "standalone";
  children: React.ReactNode;
}) {
  if (variant === "standalone") {
    return <div>{children}</div>;
  }

  return (
    <aside
      className={variant === "inline" ? "my-10" : "mt-16 mb-20"}
      style={{
        backgroundColor: "var(--surface-1)",
        border: "1px solid rgba(253, 245, 230, 0.06)",
        borderRadius: 8,
        padding: variant === "inline" ? "clamp(20px, 3vw, 28px)" : "clamp(28px, 4vw, 40px)",
      }}
    >
      {children}
    </aside>
  );
}

function getDefaults(variant: "inline" | "end-of-post" | "standalone") {
  switch (variant) {
    case "inline":
      return {
        headline: "This started as a newsletter",
        subtext: "Get the next one before it's a blog post.",
      };
    case "end-of-post":
      return {
        headline: "Want more like this",
        subtext:
          "One email when something new drops. No filler, no sequences, no growth-hacking nonsense.",
      };
    case "standalone":
      return {
        headline: "Get the newsletter",
        subtext: null,
      };
  }
}
