import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { resolveByAnswer } from "@/lib/riddles/resolve-by-answer";
import { RiddleResponse } from "./riddle-response";

interface Props {
  params: Promise<{ answer: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { answer } = await params;
  return {
    title: `${decodeURIComponent(answer)} | SuperBad`,
    robots: { index: false, follow: false },
  };
}

export default async function SayPage({ params }: Props) {
  const { answer } = await params;
  const decoded = decodeURIComponent(answer);

  const session = await auth().catch(() => null);
  const actorType = session?.user?.role === "admin" ? "admin" as const
    : session?.user ? "customer" as const
    : "public" as const;

  const result = await resolveByAnswer(decoded, {
    actorType,
    userId: session?.user?.id,
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--neutral-900)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
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
            "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(178,40,72,0.12), transparent 60%)",
            "radial-gradient(ellipse 50% 50% at 80% 80%, rgba(244,160,176,0.08), transparent 60%)",
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

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 560 }}>
        <RiddleResponse
          outcome={result.outcome}
          content={result.content}
          answer={decoded}
        />
      </div>
    </main>
  );
}
