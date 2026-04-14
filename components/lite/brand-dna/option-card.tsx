"use client";

/**
 * OptionCard — branded answer button for /lite/brand-dna question screens.
 *
 * Mirrors `mockup-brand-dna.html` `.opt`: dark surface, brand-pink border on
 * hover, -2px lift, brand-orange Righteous letter eyebrow. Selected state
 * uses brand-red — never the lime-yellow `--color-brand-primary` default that
 * leaked into the original BDA-2 build.
 */

import * as React from "react";

interface OptionCardProps {
  letter: string;
  text: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}

export function OptionCard({
  letter,
  text,
  selected = false,
  disabled = false,
  onClick,
  type = "button",
}: OptionCardProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-selected={selected || undefined}
      className="bda-opt"
      style={{
        background: selected ? "var(--brand-red)" : "rgba(34, 34, 31, 0.7)",
        border: "1px solid",
        borderColor: selected
          ? "var(--brand-red)"
          : "rgba(253, 245, 230, 0.1)",
        borderRadius: 12,
        padding: "22px 24px",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        fontFamily: "var(--font-body)",
        fontSize: 16,
        lineHeight: 1.5,
        color: selected ? "var(--brand-cream)" : "var(--neutral-300)",
        position: "relative",
        overflow: "hidden",
        transition:
          "background 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1), color 300ms cubic-bezier(0.16, 1, 0.3, 1)",
        width: "100%",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-label)",
          fontSize: 10,
          letterSpacing: "2px",
          color: selected ? "var(--brand-cream)" : "var(--brand-orange)",
          textTransform: "uppercase",
          display: "block",
          marginBottom: 8,
          opacity: selected ? 0.85 : 1,
        }}
      >
        {letter}
      </span>
      {text}

      <style jsx>{`
        .bda-opt:hover:not(:disabled):not([data-selected]) {
          background: rgba(34, 34, 31, 0.95) !important;
          border-color: rgba(244, 160, 176, 0.4) !important;
          transform: translateY(-2px);
          color: var(--brand-cream) !important;
        }
        .bda-opt:focus-visible {
          outline: 2px solid var(--brand-pink);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .bda-opt {
            transition: background 200ms ease, color 200ms ease,
              border-color 200ms ease !important;
          }
          .bda-opt:hover:not(:disabled):not([data-selected]) {
            transform: none !important;
          }
        }
      `}</style>
    </button>
  );
}
