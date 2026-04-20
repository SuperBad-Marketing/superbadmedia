import type { Metadata } from "next";
import { listRoleBriefs } from "@/lib/hiring/queries";
import settings from "@/lib/settings";
import { ApplyFormClient } from "./apply-form-client";

export const metadata: Metadata = {
  title: "Work with SuperBad",
  description:
    "Apply to join SuperBad's contractor bench. Show us your work.",
  openGraph: {
    title: "Work with SuperBad",
    description:
      "Apply to join SuperBad's contractor bench. Show us your work.",
    type: "website",
  },
};

const DEFAULT_RATE_BANDS = [
  "Under $30/hr",
  "$30–50/hr",
  "$50–80/hr",
  "$80–120/hr",
  "$120+/hr",
];

export default async function ApplyPage() {
  const briefs = await listRoleBriefs({ status: ["open"] });
  const roleBriefOptions = briefs.map((b) => ({
    id: b.id,
    roleName: b.role_name,
  }));

  let rateBands: string[];
  try {
    const stored = await settings.get("hiring.apply.rate_bands");
    rateBands = Array.isArray(stored) ? (stored as string[]) : DEFAULT_RATE_BANDS;
  } catch {
    rateBands = DEFAULT_RATE_BANDS;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "80px 24px 64px",
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

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 520 }}>
        <header style={{ marginBottom: 48 }}>
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
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              lineHeight: 1.15,
              color: "var(--brand-cream)",
              margin: "12px 0 16px",
            }}
          >
            Work with us.
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
            Show us your work, tell us what you&apos;re after, and
            we&apos;ll take it from there. No cover letters.
          </p>
        </header>

        <ApplyFormClient
          roleBriefs={roleBriefOptions}
          rateBands={rateBands}
        />
      </div>
    </main>
  );
}
