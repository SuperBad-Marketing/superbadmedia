/**
 * Free Audit Tool — public inbound lead-generation surface.
 *
 * Business owner enters details, gets an instant A–F marketing
 * health scorecard + branded PDF emailed. Reuses LG enrichment
 * pipeline. Creates warm Deal with auto-drafted follow-up.
 *
 * Owner: AT-2. Route: /get-started/audit.
 */
import type { Metadata } from "next";
import Script from "next/script";
import { AuditClient } from "./_components/audit-client";

export const metadata: Metadata = {
  title: "Free Marketing Audit — SuperBad",
  description:
    "Enter your details and get an honest A–F scorecard of your marketing in under 30 seconds. No sign-up required.",
  openGraph: {
    title: "Free Marketing Audit — SuperBad",
    description:
      "Get an honest A–F scorecard of your marketing in under 30 seconds.",
  },
};

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="lazyOnload"
        />
      )}
      <AuditClient />
    </div>
  );
}
