/**
 * Onboarding placeholder — Brand DNA gate redirect target.
 *
 * The Brand DNA gate middleware redirects every admin route here until:
 *   (a) The SuperBad-self Brand DNA Assessment is completed (BDA-3), OR
 *   (b) BRAND_DNA_GATE_BYPASS=true is set in the environment.
 *
 * BDA-1 builds the real onboarding surface (Brand DNA wizard for Andy).
 * A8 ships this placeholder so the redirect chain is testable end-to-end.
 *
 * Owner: A8 (placeholder). Replaced by: BDA-1.
 */

export default function OnboardingPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "sans-serif",
        color: "#111",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
        Welcome to SuperBad
      </h1>
      <p style={{ maxWidth: "32rem", textAlign: "center", color: "#555" }}>
        Before you can access the dashboard, we need to capture your brand
        voice. The Brand DNA Assessment is coming in the next build session.
      </p>
    </main>
  );
}
