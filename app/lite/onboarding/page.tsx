/**
 * `/lite/onboarding` — dual-purpose landing.
 *
 * - Admins without a complete SuperBad-self Brand DNA profile land here
 *   via the middleware's Gate 1 redirect (see `proxy.ts`). The A8
 *   placeholder copy stays below the role branch.
 * - SaaS subscribers (role="client") land here from the magic-link
 *   redeem redirect (`/api/auth/magic-link`). SB-6b replaces the SB-6a
 *   minimal card with the status-aware dashboard client.
 *
 * Owners: A8 (admin path), SB-6a (client primitive), SB-6b (status
 * variants + Brand DNA CTA + motion).
 */
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { contacts } from "@/lib/db/schema/contacts";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import { loadDashboardUsage } from "@/lib/saas-products/usage";
import { OnboardingDashboardClient } from "./clients/onboarding-dashboard-client";
import { killSwitches } from "@/lib/kill-switches";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your SuperBad — Welcome",
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "client" && session?.user?.email) {
    const summary = await loadSubscriberSummary(session.user.email);
    if (summary) {
      const emailNorm = session.user.email.trim().toLowerCase();
      const contact = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.email_normalised, emailNorm))
        .get();
      const usage = contact
        ? await loadDashboardUsage(contact.id, summary.productId)
        : null;
      return (
        <OnboardingDashboardClient
          summary={summary}
          usage={usage}
          paymentRecoveryEnabled={killSwitches.saas_payment_recovery_enabled}
        />
      );
    }
    // Client session but no SaaS deal on file — rare race window between
    // promotion + deal row hydration. Fall through to the admin placeholder
    // shape (dry copy, no broken chrome).
  }

  // Admin path — Brand DNA gate.
  const bypassAvailable = process.env.BRAND_DNA_GATE_BYPASS === "true";

  return (
    <main
      className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center gap-6 px-6 py-16 text-center"
      data-testid="admin-onboarding"
    >
      <h1 className="font-heading text-2xl font-semibold">
        One thing before we start.
      </h1>
      <p className="text-foreground/60 max-w-[36ch] text-sm leading-relaxed">
        SuperBad needs to understand your brand before it can work for you.
        This takes about ten minutes.
      </p>
      <a
        href="/lite/brand-dna"
        className="bg-foreground text-background hover:bg-foreground/90 mt-2 inline-block rounded-md px-6 py-3 text-sm font-medium transition-colors"
      >
        Begin Brand DNA
      </a>
      {bypassAvailable && (
        <a
          href="/lite/admin/pipeline"
          className="text-foreground/40 hover:text-foreground/60 mt-4 text-xs transition-colors"
        >
          Skip for now
        </a>
      )}
    </main>
  );
}
