import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Application Received — SuperBad",
  robots: { index: false },
};

export default function ApplyConfirmationPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 24px",
        position: "relative",
      }}
    >
      {/* Atmosphere */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242,140,82,0.18), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178,40,72,0.15), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 0% 80%, rgba(244,160,176,0.10), transparent 60%)",
          ].join(","),
        }}
      />
      {/* Noise */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          opacity: 0.035,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 480,
          textAlign: "center",
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
          SuperBad
        </span>
        <h1
          style={{
            fontFamily: "var(--font-narrative)",
            fontStyle: "italic",
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            lineHeight: 1.15,
            color: "var(--brand-cream)",
            margin: "12px 0 20px",
          }}
        >
          Got it.
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 16,
            color: "var(--neutral-500)",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          We&apos;ll have a look through your work and follow up shortly.
          Check your inbox — there might be a question waiting.
        </p>
      </div>
    </main>
  );
}
