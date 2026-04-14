import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SuperBad — not yet",
  description: "We're building something. It's not ready. You're early.",
};

export default function Home() {
  return (
    <main
      className="relative flex flex-1 overflow-hidden"
      style={{ backgroundColor: "var(--neutral-900)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 18% 28%, rgba(242,140,82,0.10), transparent 70%), radial-gradient(50% 45% at 85% 85%, rgba(178,40,72,0.14), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-8 py-10 sm:px-16 sm:py-14">
        <header className="flex items-start justify-between">
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-300)",
            }}
          >
            SuperBad Marketing
            <span
              aria-hidden
              style={{
                display: "inline-block",
                margin: "0 10px",
                color: "var(--brand-orange)",
              }}
            >
              ·
            </span>
            Melbourne
          </p>
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            MMXXVI
          </p>
        </header>

        <section className="flex max-w-5xl flex-col gap-8 py-16">
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "var(--brand-pink)",
            }}
          >
            — Coming, eventually
          </p>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(96px, 18vw, 240px)",
              lineHeight: 0.88,
              color: "var(--neutral-100)",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Not
            <span style={{ color: "var(--brand-red)" }}>.</span>
            <br />
            Yet
            <span style={{ color: "var(--brand-orange)" }}>.</span>
          </h1>

          <p
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "var(--text-narrative)",
              lineHeight: "var(--text-narrative-lh)",
              color: "var(--neutral-300)",
              maxWidth: "38ch",
            }}
          >
            We&rsquo;re building something. It&rsquo;s not ready. You&rsquo;re
            early.
          </p>
        </section>

        <footer className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: "var(--text-small)",
              color: "var(--brand-pink)",
              maxWidth: "42ch",
            }}
          >
            come back later. or don&rsquo;t. we&rsquo;ll be here either way.
          </p>
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
            }}
          >
            hello
            <span style={{ color: "var(--neutral-600)" }}>@</span>
            superbadmedia.com.au
          </p>
        </footer>
      </div>
    </main>
  );
}
