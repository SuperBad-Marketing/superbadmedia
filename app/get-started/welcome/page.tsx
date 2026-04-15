/**
 * `/get-started/welcome` — transient post-checkout landing.
 *
 * Arriving clients:
 *   - If already authenticated as `role="client"`, redirect to
 *     `/lite/onboarding` immediately.
 *   - Otherwise show a "receipt on the way" interstitial + a resend
 *     button — the magic-link email is typically already on its way
 *     from `invoice.payment_succeeded`, but the button covers the case
 *     where the webhook hasn't fired yet or the subscriber missed it.
 *
 * Owner: SB-5 (placeholder) → SB-6a (real transient landing).
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FOOTER_COPY } from "@/lib/content/pricing-page";
import { auth } from "@/lib/auth/session";
import { ResendLoginClient } from "./clients/resend-login-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Welcome — SuperBad",
  description: "Payment received. Onboarding next.",
  robots: { index: false, follow: false },
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; error?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user?.role === "client") {
    redirect("/lite/onboarding");
  }

  const sp = await searchParams;
  const emailParam = Array.isArray(sp.email) ? sp.email[0] : sp.email;
  const email = emailParam?.trim() || null;
  const errorParam = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  const errorMessage =
    errorParam === "link_invalid"
      ? "That login link has expired or been used already. Ask for a fresh one below."
      : errorParam === "missing_token"
        ? "That link was missing a token. Ask for a fresh one below."
        : null;

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
          ? `A login link is on the way to ${email}. Check your inbox — it usually lands within a minute.`
          : "A login link is on the way to the email you checked out with. Check your inbox — it usually lands within a minute."}
      </p>
      {errorMessage ? (
        <p
          className="mt-6 text-sm text-[#c8312b]"
          role="alert"
          data-testid="welcome-error"
        >
          {errorMessage}
        </p>
      ) : null}

      <ResendLoginClient initialEmail={email} />

      <p className="text-foreground/50 mt-10 text-xs">
        Stuck?{" "}
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
