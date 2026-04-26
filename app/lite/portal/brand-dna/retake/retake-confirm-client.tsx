"use client";

/**
 * RetakeConfirmClient — confirmation before starting a retake.
 *
 * Owner: BDA-5.
 */

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";

import { houseSpring } from "@/lib/design-tokens";

interface RetakeConfirmClientProps {
  retakeAction: () => Promise<void>;
}

export function RetakeConfirmClient({
  retakeAction,
}: RetakeConfirmClientProps) {
  const [pending, setPending] = React.useState(false);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    await retakeAction();
    setPending(false);
  }

  return (
    <main
      className="bda-retake-main"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        gap: 32,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...houseSpring, duration: 1.0 }}
        style={{
          maxWidth: 520,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-label)",
            fontSize: 10,
            letterSpacing: "3px",
            textTransform: "uppercase",
            color: "var(--brand-pink)",
          }}
        >
          Retake assessment
        </span>

        <h1
          className="bda-retake-heading"
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
          Start fresh?
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--neutral-400)",
          }}
        >
          A retake is a full assessment from scratch — no anchoring to your
          previous answers. Your current profile stays archived, and the new
          one becomes active. At the end, we&apos;ll show you what shifted.
        </p>

        <div
          className="bda-retake-actions"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={pending}
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--brand-cream)",
              background: "var(--brand-red, #c23b22)",
              border: "1px solid var(--brand-red, #c23b22)",
              borderRadius: 999,
              padding: "14px 32px",
              cursor: pending ? "default" : "pointer",
              opacity: pending ? 0.6 : 1,
              transition: "all 300ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {pending ? "Starting..." : "Begin retake"}
          </button>

          <Link
            href="/lite/portal/brand-dna/profile"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: 11,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              background: "transparent",
              border: "1px solid rgba(253, 245, 230, 0.12)",
              borderRadius: 999,
              padding: "14px 24px",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            Keep current
          </Link>
        </div>
      </motion.div>

      <style jsx>{`
        @media (max-width: 640px) {
          .bda-retake-main {
            padding: 24px 20px !important;
          }
          :global(.bda-retake-heading) {
            font-size: 26px !important;
          }
          :global(.bda-retake-actions) {
            flex-direction: column !important;
            align-items: center !important;
          }
        }
      `}</style>
    </main>
  );
}
