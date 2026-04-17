/**
 * Content Engine demo landing page (spec §3.4).
 *
 * Two-input demo: vertical + location-locked. Full pipeline output
 * in SuperBad's own voice. No email gate. No sign-up required.
 *
 * "This is us talking about YOUR area of expertise — imagine what
 * could happen if our tool knew who you were."
 *
 * Demo result persists to account on signup (wired in SaaS billing wave).
 *
 * Owner: CE-13. Route: /get-started/content-engine.
 */
import type { Metadata } from "next";
import { ContentEngineDemoClient } from "./_components/demo-client";

export const metadata: Metadata = {
  title: "Content Engine Demo — SuperBad",
  description:
    "See what our Content Engine would write about your area of expertise. No sign-up required.",
  openGraph: {
    title: "Content Engine Demo — SuperBad",
    description:
      "See what our Content Engine would write about your area of expertise.",
  },
};

export default function ContentEngineDemoPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <div className="space-y-4 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
          Content Engine
        </h1>
        <p className="text-lg text-foreground/60">
          Tell us what you do. We&apos;ll show you what we&apos;d write.
        </p>
        <p className="text-sm text-foreground/40">
          No sign-up. No email. Just the output.
        </p>
      </div>

      <div className="mt-12">
        <ContentEngineDemoClient />
      </div>
    </div>
  );
}
