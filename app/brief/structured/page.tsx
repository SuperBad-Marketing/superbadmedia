import type { Metadata } from "next";
import { StructuredBriefForm } from "./structured-brief-form";

export const metadata: Metadata = {
  title: "SuperBad — Detailed Brief",
  description: "Submit a detailed shoot or edit brief to SuperBad.",
};

export default function StructuredBriefPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--color-surface-1)" }}
    >
      <div className="w-full max-w-[600px]">
        <div className="mb-8 text-center">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            SuperBad
          </div>
          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-[36px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Detailed Brief
          </h1>
          <p className="mt-3 font-[family-name:var(--font-body)] text-[15px] leading-[1.55] text-[color:var(--color-neutral-400)]">
            The full picture. Every detail makes the end result sharper.{" "}
            <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
              precision is a creative act.
            </em>
          </p>
        </div>
        <StructuredBriefForm />
      </div>
    </div>
  );
}
