/**
 * ProgressChrome — top-bar of /lite/brand-dna/**.
 *
 * Pacifico SuperBad wordmark left, segmented progress bar right.
 * Five segments — one per BDA section. `currentSection = 0` shows no active
 * segment (alignment-gate landing). `currentSection = 'reveal'` marks all five
 * as done. Mirrors `mockup-brand-dna.html`.
 */

import * as React from "react";

export interface ProgressChromeProps {
  /** 0 = landing/alignment-gate, 1–5 = sections, "reveal" = post-completion */
  currentSection: 0 | 1 | 2 | 3 | 4 | 5 | "reveal";
  /** Optional human label for the active segment, e.g. "identity". */
  sectionLabel?: string;
}

export function ProgressChrome({ currentSection, sectionLabel }: ProgressChromeProps) {
  const segments = [1, 2, 3, 4, 5] as const;

  return (
    <header
      style={{
        position: "relative",
        zIndex: 3,
        padding: "28px 40px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-logo)",
          fontSize: 22,
          color: "var(--brand-cream)",
          opacity: 0.9,
          letterSpacing: 0,
        }}
      >
        SuperBad
      </span>

      <div
          aria-label={
            currentSection === 0
              ? "Progress: not started"
              : currentSection === "reveal"
                ? "Progress: complete"
                : `Progress: section ${currentSection} of 5`
          }
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
          }}
        >
          {segments.map((n) => {
            const done =
              currentSection === "reveal" || (typeof currentSection === "number" && n < currentSection);
            const active = typeof currentSection === "number" && n === currentSection;
            return (
              <span
                key={n}
                style={{
                  width: 44,
                  height: 2,
                  borderRadius: 2,
                  position: "relative",
                  overflow: "hidden",
                  background: done
                    ? "var(--brand-pink)"
                    : "rgba(253, 245, 230, 0.1)",
                }}
              >
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--brand-cream)",
                      transformOrigin: "left",
                      transform: "scaleX(0.4)",
                    }}
                  />
                )}
              </span>
            );
          })}
          <span
            style={{
              marginLeft: 12,
              fontFamily: "var(--font-label)",
              fontSize: 10,
              letterSpacing: "2px",
              color: "var(--neutral-500)",
              textTransform: "uppercase",
            }}
          >
            {currentSection === 0 ? (
              <>brand dna · <em style={{ color: "var(--brand-pink)", fontStyle: "normal" }}>5 sections</em></>
            ) : currentSection === "reveal" ? (
              <>brand dna · <em style={{ color: "var(--brand-pink)", fontStyle: "normal" }}>complete</em></>
            ) : (
              <>
                section <em style={{ color: "var(--brand-pink)", fontStyle: "normal" }}>{currentSection} of 5</em>
                {sectionLabel ? ` · ${sectionLabel}` : null}
              </>
            )}
          </span>
        </div>
    </header>
  );
}
