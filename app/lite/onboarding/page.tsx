/**
 * `/lite/onboarding` — dual-purpose landing.
 *
 * - Admins without a complete SuperBad-self Brand DNA profile land here
 *   via the middleware's Gate 1 redirect (see `proxy.ts`). The real
 *   admin onboarding UI lands in BDA-1 — A8's placeholder copy is kept
 *   below the role branch.
 * - SaaS subscribers (role="client") land here from the magic-link
 *   redeem redirect (`/api/auth/magic-link`). SB-6a ships a minimal
 *   locked dashboard: subscription summary + "Andy will be in touch"
 *   framing; SB-6b fills in status variants, the Brand DNA CTA, and
 *   motion polish.
 *
 * Owners: A8 (admin path), SB-6a (client path), SB-6b (client polish).
 */
import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your SuperBad — Welcome",
  robots: { index: false, follow: false },
};

async function loadSubscriberSummary(email: string) {
  const contact = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.email_normalised, email.trim().toLowerCase()))
    .get();
  if (!contact) return null;

  const deal = await db
    .select({
      id: deals.id,
      saas_product_id: deals.saas_product_id,
      saas_tier_id: deals.saas_tier_id,
      billing_cadence: deals.billing_cadence,
      subscription_state: deals.subscription_state,
    })
    .from(deals)
    .where(eq(deals.primary_contact_id, contact.id))
    .orderBy(desc(deals.created_at_ms))
    .limit(1)
    .get();
  if (!deal?.saas_product_id) return null;

  const product = await db
    .select({ name: saas_products.name })
    .from(saas_products)
    .where(eq(saas_products.id, deal.saas_product_id))
    .get();
  const tier = deal.saas_tier_id
    ? await db
        .select({ name: saas_tiers.name })
        .from(saas_tiers)
        .where(eq(saas_tiers.id, deal.saas_tier_id))
        .get()
    : null;

  return {
    productName: product?.name ?? "SuperBad",
    tierName: tier?.name ?? null,
    billingCadence: deal.billing_cadence,
    subscriptionState: deal.subscription_state,
  };
}

function cadenceLabel(c: string | null): string {
  if (c === "annual_upfront") return "Annual — paid upfront";
  if (c === "annual_monthly") return "Annual — billed monthly";
  if (c === "monthly") return "Monthly";
  return "—";
}

export default async function OnboardingPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (role === "client" && session?.user?.email) {
    const summary = await loadSubscriberSummary(session.user.email);
    return (
      <main
        className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-start justify-center gap-6 px-6 py-16"
        data-testid="subscriber-onboarding"
      >
        <p className="text-foreground/50 text-xs uppercase tracking-[0.22em]">
          You're in
        </p>
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          Welcome to SuperBad.
        </h1>
        {summary ? (
          <div
            className="border-foreground/10 rounded-md border px-5 py-4 text-sm"
            data-testid="subscription-summary"
          >
            <div className="text-foreground/60 mb-1 text-xs uppercase tracking-[0.18em]">
              Your subscription
            </div>
            <div className="text-base font-semibold">
              {summary.productName}
              {summary.tierName ? ` · ${summary.tierName}` : ""}
            </div>
            <div className="text-foreground/70 text-sm">
              {cadenceLabel(summary.billingCadence)}
              {summary.subscriptionState
                ? ` · ${summary.subscriptionState}`
                : ""}
            </div>
          </div>
        ) : null}
        <p className="text-foreground/70 text-base leading-relaxed">
          Andy will be in touch within a business day to get onboarding
          started. The real dashboard — Brand DNA setup, content engine,
          the works — is landing shortly.
        </p>
      </main>
    );
  }

  // Admin path — unchanged from A8 placeholder, styled consistently.
  return (
    <main
      className="mx-auto flex min-h-[80dvh] max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center"
      data-testid="admin-onboarding"
    >
      <h1 className="font-heading text-2xl font-semibold">
        One thing before we start.
      </h1>
      <p className="text-foreground/60 max-w-[32ch] text-sm">
        SuperBad Lite needs to understand your brand before it can help you.
        The Brand DNA setup is coming soon.
      </p>
      <p className="text-foreground/40 mt-8 text-xs">
        Set <code>BRAND_DNA_GATE_BYPASS=true</code> in .env.local to skip this
        during development.
      </p>
    </main>
  );
}
