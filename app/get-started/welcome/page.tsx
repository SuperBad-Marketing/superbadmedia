/**
 * `/get-started/welcome` — post-checkout landing.
 *
 * Minimal placeholder. SB-6 builds the real locked onboarding dashboard
 * behind magic-link auth; this page just confirms the payment landed
 * and points at Andy's email while the subscriber-side auth primitive
 * is still being built.
 *
 * Owner: SB-5. Successor: SB-6.
 */
import type { Metadata } from "next";

import { FOOTER_COPY } from "@/lib/content/pricing-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome — SuperBad",
  description: "Payment received. Onboarding next.",
  robots: { index: false, follow: false },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const sp = await searchParams;
  const emailParam = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const email = emailParam?.trim() || null;

  return (
    <section
      className="mx-auto max-w-xl px-6 py-20 text-center"
      data-testid="welcome-page"
    >
      <p className="text-foreground/50 mb-2 text-xs uppercase tracking-[0.22em]">
        We're in
      </p>
      <h1 className="font-heading mb-4 text-3xl font-semibold md:text-4xl">
        Payment received.
      </h1>
      <p className="text-foreground/70 text-base leading-relaxed">
        {email
          ? `Thanks. A receipt's on the way to ${email}. Andy will be in touch within a business day to get onboarding started.`
          : "Thanks. A receipt's on the way. Andy will be in touch within a business day to get onboarding started."}
      </p>
      <p className="text-foreground/50 mt-8 text-xs">
        Questions in the meantime?{" "}
        <a
          href={`mailto:${FOOTER_COPY.supportEmail}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {FOOTER_COPY.supportEmail}
        </a>
      </p>
    </section>
  );
}
