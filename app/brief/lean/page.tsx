import type { Metadata } from "next";
import { LeanBriefForm } from "./lean-brief-form";

export const metadata: Metadata = {
  title: "SuperBad — Quick Brief",
  description: "Submit a quick shoot or edit brief to SuperBad.",
};

export default function LeanBriefPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: "var(--color-surface-1)" }}
    >
      <div className="w-full max-w-[520px]">
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
            Quick Brief
          </h1>
          <p className="mt-3 font-[family-name:var(--font-body)] text-[15px] leading-[1.55] text-[color:var(--color-neutral-400)]">
            Tell us what you need. Five fields, no fluff.{" "}
            <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
              the short version.
            </em>
          </p>
        </div>
        <LeanBriefForm />
      </div>
    </div>
  );
}
