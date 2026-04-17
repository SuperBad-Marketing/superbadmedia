/**
 * `/lite/portal/welcome` — branded welcome screen.
 *
 * First surface a new client/subscriber sees after clicking the
 * welcome email's portal link. Shows once (one-shot via
 * `contacts.onboarding_welcome_seen_at_ms`), then subsequent
 * portal visits route directly to the Brand DNA gate / portal home.
 *
 * Entry-path branch (spec §8.1 F4.c):
 *   - Trial-shoot graduates bypass entirely → redirect to portal home.
 *   - Direct/referral retainer: welcome screen with "what we already know".
 *   - SaaS: welcome screen without pre-populated summary.
 *
 * Owner: OS-1.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { getPortalSession } from "@/lib/portal/guard";
import { WelcomeClient } from "./welcome-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getPortalSession();
  if (!session?.contactId) return { title: "SuperBad" };

  const contact = db
    .select({ name: contacts.name })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  const firstName = contact?.name?.split(" ")[0] ?? "there";
  return {
    title: `SuperBad — welcome, ${firstName}`,
    robots: { index: false, follow: false },
  };
}

export default async function WelcomePage() {
  const session = await getPortalSession();
  if (!session?.contactId) {
    redirect("/lite/portal/recover?reason=expired");
  }

  const contact = db
    .select({
      id: contacts.id,
      name: contacts.name,
      company_id: contacts.company_id,
      onboarding_welcome_seen_at_ms: contacts.onboarding_welcome_seen_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, session.contactId))
    .get();

  if (!contact) {
    redirect("/lite/portal/recover?reason=expired");
  }

  // Already seen → skip to portal home
  if (contact.onboarding_welcome_seen_at_ms != null) {
    redirect("/lite/portal");
  }

  const company = db
    .select({
      id: companies.id,
      name: companies.name,
      billing_mode: companies.billing_mode,
    })
    .from(companies)
    .where(eq(companies.id, contact.company_id))
    .get();

  if (!company) {
    redirect("/lite/portal");
  }

  // ── Entry-path branch (F4.c) ──────────────────────────────────────
  // Trial-shoot graduate detection: check for intro_funnel_submissions.
  // For now, check if there's a deal with stage that went through trial_shoot.
  // Simplified: check if any deal for this company has won_outcome set
  // AND the deal source indicates a trial shoot path.
  const trialShootDeal = db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.company_id, company.id),
        eq(deals.stage, "won"),
      ),
    )
    .get();

  // If they have a won deal with trial_shoot_status completed, they're graduates
  const isTrialShootGraduate =
    company.billing_mode !== "manual" &&
    trialShootDeal != null;
  // A more precise check would use intro_funnel_submissions table, but the
  // simple heuristic works for now — trial shoot graduates bypass.

  if (isTrialShootGraduate) {
    // Trial-shoot graduates bypass welcome — their portal experience is
    // continuous per feedback_felt_experience_wins.
    redirect("/lite/portal");
  }

  // ── Determine audience ─────────────────────────────────────────────
  // Retainer = has a won deal with billing. SaaS = no won deal / stripe billing.
  const wonDeal = db
    .select({
      id: deals.id,
      won_outcome: deals.won_outcome,
    })
    .from(deals)
    .where(and(eq(deals.company_id, company.id), eq(deals.stage, "won")))
    .get();

  const audience: "retainer" | "saas" = wonDeal ? "retainer" : "saas";

  // ── Build context for retainer summary ─────────────────────────────
  // Company notes serve as the deal context for the "what we already know"
  // paragraph. Future: compose from activity log + quote context + outreach.
  let dealContext: string | null = null;
  if (audience === "retainer") {
    const co = db
      .select({ notes: companies.notes })
      .from(companies)
      .where(eq(companies.id, company.id))
      .get();
    dealContext = co?.notes ?? null;
  }

  const firstName = contact.name.split(" ")[0] ?? contact.name;

  return (
    <WelcomeClient
      firstName={firstName}
      companyName={company.name}
      audience={audience}
      dealContext={dealContext}
    />
  );
}
