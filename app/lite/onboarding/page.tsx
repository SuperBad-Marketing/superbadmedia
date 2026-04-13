/**
 * Onboarding placeholder — Brand DNA Gate redirect target.
 *
 * This route is where the middleware (middleware.ts) redirects every admin
 * user whose SuperBad-self Brand DNA profile is not yet complete. The full
 * Brand DNA Assessment UI lands in BDA-1 (Wave 3); this placeholder ensures
 * the redirect resolves to a valid page rather than a 404.
 *
 * BRAND_DNA_GATE_BYPASS=true in .env.local skips this redirect entirely
 * during development so the rest of the admin surface is accessible before
 * the Brand DNA Assessment is built.
 *
 * Owner: A8 (placeholder). Real page owner: BDA-1.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set up your brand — SuperBad Lite",
};

export default function OnboardingPage() {
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
        textAlign: "center",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
        One thing before we start.
      </h1>
      <p style={{ maxWidth: "32ch", color: "var(--color-neutral-500, #6b7280)" }}>
        SuperBad Lite needs to understand your brand before it can help you.
        The Brand DNA setup is coming soon.
      </p>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-neutral-400, #9ca3af)",
          marginTop: "2rem",
        }}
      >
        Set <code>BRAND_DNA_GATE_BYPASS=true</code> in .env.local to skip this
        during development.
      </p>
    </main>
  );
}
