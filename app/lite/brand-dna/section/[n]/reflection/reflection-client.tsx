"use client";

/**
 * ReflectionClient — free-form reflection UI (section 5 only).
 *
 * Mockup scene-2 register: Righteous label, brand-cream prompt, brand-pink
 * accents, brand-red submit pill. Skip stays soft. Removes the lime-yellow
 * `--color-brand-primary` fallback that leaked from BDA-2.
 *
 * Owners: BDA-2 (logic), BDA-POLISH-1 (visual port).
 */

import * as React from "react";
import { motion } from "framer-motion";
import { houseSpring } from "@/lib/design-tokens";

interface ReflectionClientProps {
  profileId: string;
  submitAction: (formData: FormData) => Promise<void>;
}

export function ReflectionClient({
  profileId,
  submitAction,
}: ReflectionClientProps) {
  const [pending, setPending] = React.useState(false);
  const [text, setText] = React.useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await submitAction(fd);
    setPending(false);
  }

  async function handleSkip() {
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("reflection", "");
    await submitAction(fd);
    setPending(false);
  }

  const empty = text.trim().length === 0;

  return (
    <motion.main
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...houseSpring, duration: 1.0 }}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 32,
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
            marginBottom: 16,
          }}
        >
          Before the reveal
        </p>
        <h2
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            fontSize: 32,
            lineHeight: 1.25,
            color: "var(--brand-cream)",
            letterSpacing: "-0.6px",
            margin: 0,
          }}
        >
          Anything you want to add?
        </h2>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "var(--neutral-500)",
            fontStyle: "italic",
          }}
        >
          Optional. Goes into your portrait alongside your answers.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}
      >
        <input type="hidden" name="profileId" value={profileId} />

        <textarea
          name="reflection"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="What did this bring up? What did you notice? What's missing from the picture so far?"
          disabled={pending}
          style={{
            background: "rgba(34, 34, 31, 0.7)",
            color: "var(--brand-cream)",
            border: "1px solid rgba(253, 245, 230, 0.1)",
            borderRadius: 12,
            padding: "16px 18px",
            fontFamily: "var(--font-body)",
            fontSize: 16,
            lineHeight: 1.6,
            resize: "vertical",
            width: "100%",
            outline: "none",
          }}
        />

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            type="submit"
            disabled={pending || empty}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              background: empty ? "transparent" : "var(--brand-red)",
              border: "1px solid",
              borderColor: empty ? "rgba(253, 245, 230, 0.25)" : "var(--brand-red)",
              borderRadius: 999,
              padding: "14px 32px",
              cursor: pending || empty ? "default" : "pointer",
              opacity: pending ? 0.6 : 1,
              transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Add to my portrait
          </button>

          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={pending}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              background: "transparent",
              border: "1px solid rgba(253, 245, 230, 0.1)",
              borderRadius: 999,
              padding: "14px 24px",
              cursor: pending ? "default" : "pointer",
              transition: "color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            Skip
          </button>
        </div>
      </form>
    </motion.main>
  );
}
