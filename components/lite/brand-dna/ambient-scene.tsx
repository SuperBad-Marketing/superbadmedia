"use client";

/**
 * AmbientScene — fixed-position ambient blob world for /lite/brand-dna/**.
 *
 * Three blurred coloured blobs + SVG noise overlay, transformed per scene
 * (1 = question, 2 = insight, 3 = reveal). Mirrors `mockup-brand-dna.html`.
 * Reduced-motion users get a static fade — no transform, no transition.
 */

import * as React from "react";

const SPRING = "cubic-bezier(0.16, 1, 0.3, 1)";

const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export type BrandDnaScene = 1 | 2 | 3;

interface AmbientSceneProps {
  scene: BrandDnaScene;
}

/** Per-scene blob transforms — derived directly from the mockup. */
const BLOB_STYLES: Record<
  BrandDnaScene,
  { b1: React.CSSProperties; b2: React.CSSProperties; b3: React.CSSProperties; filter?: string }
> = {
  1: {
    b1: { background: "var(--brand-red)", transform: "translate(0,0) scale(1)", opacity: 0.35 },
    b2: { background: "var(--brand-orange)", transform: "translate(0,0)", opacity: 0.3 },
    b3: { background: "var(--brand-pink)", transform: "translate(0,0)", opacity: 0.12 },
  },
  2: {
    b1: { background: "var(--brand-orange)", transform: "translate(100px, 200px) scale(1.2)", opacity: 0.35 },
    b2: { background: "var(--brand-pink)", transform: "translate(-200px, -100px)", opacity: 0.3 },
    b3: { background: "var(--brand-pink)", transform: "translate(0,0)", opacity: 0.12 },
  },
  3: {
    b1: { background: "var(--brand-red)", transform: "translate(-200px, -100px) scale(1.4)", opacity: 0.35 },
    b2: { background: "var(--brand-orange)", transform: "translate(100px, 100px)", opacity: 0.45 },
    b3: { background: "var(--brand-pink)", transform: "translate(0,0)", opacity: 0.2 },
    filter: "saturate(1.3)",
  },
};

export function AmbientScene({ scene }: AmbientSceneProps) {
  const blobs = BLOB_STYLES[scene];
  const transition = `all 2400ms ${SPRING}`;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          filter: blobs.filter,
          transition: `filter 1200ms ${SPRING}`,
        }}
      >
        <Blob
          style={{
            ...blobs.b1,
            width: 600,
            height: 600,
            top: -100,
            left: -150,
            transition,
          }}
        />
        <Blob
          style={{
            ...blobs.b2,
            width: 500,
            height: 500,
            bottom: -150,
            right: -100,
            transition,
          }}
        />
        <Blob
          style={{
            ...blobs.b3,
            width: 400,
            height: 400,
            top: "40%",
            left: "50%",
            transition,
          }}
        />
      </div>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.04,
          mixBlendMode: "overlay",
          backgroundImage: NOISE_URL,
        }}
      />
      {/* Reduced-motion: cut transitions, keep static composition. */}
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          div[aria-hidden="true"] {
            transition: none !important;
          }
          div[aria-hidden="true"] > * {
            transition: none !important;
          }
        }
      `}</style>
    </>
  );
}

function Blob({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: "50%",
        filter: "blur(80px)",
        ...style,
      }}
    />
  );
}
