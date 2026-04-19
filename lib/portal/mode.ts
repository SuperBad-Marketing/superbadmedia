import { db } from "@/lib/db";
import { deals } from "@/lib/db/schema/deals";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { contacts } from "@/lib/db/schema/contacts";
import { eq, and } from "drizzle-orm";

export type PortalMode = "pre_retainer" | "retainer" | "archived";

export interface PortalModeResult {
  mode: PortalMode;
  brandDnaComplete: boolean;
  retainerKickoffSaid: boolean;
}

/**
 * Derive the portal rendering mode for a contact.
 *
 * Mode logic (§10.0):
 * - `retainer`: deals.stage = 'won' with active subscription
 * - `archived`: 60-day post-shoot non-converter (not yet implemented; returns pre_retainer)
 * - `pre_retainer`: everything else (trial-shoot non-converter, in-progress)
 *
 * Also checks Brand DNA gate status for the retainer-mode hard lock (§10.0 F4.b).
 *
 * Owner: CM-6.
 */
export async function getPortalMode(
  contactId: string,
): Promise<PortalModeResult> {
  const [contact] = await db
    .select({
      company_id: contacts.company_id,
      retainer_kickoff_bartender_said_at_ms:
        contacts.retainer_kickoff_bartender_said_at_ms,
    })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!contact) {
    return {
      mode: "pre_retainer",
      brandDnaComplete: false,
      retainerKickoffSaid: false,
    };
  }

  const wonDeal = await db
    .select({ stage: deals.stage, subscription_state: deals.subscription_state })
    .from(deals)
    .where(
      and(eq(deals.company_id, contact.company_id), eq(deals.stage, "won")),
    )
    .limit(1);

  const isRetainer =
    wonDeal.length > 0 &&
    wonDeal[0].subscription_state != null &&
    ["active_current", "past_due", "paused"].includes(wonDeal[0].subscription_state);

  const [bdProfile] = await db
    .select({ status: brand_dna_profiles.status })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.contact_id, contactId),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .limit(1);

  const brandDnaComplete = !!bdProfile;
  const retainerKickoffSaid =
    contact.retainer_kickoff_bartender_said_at_ms != null;

  return {
    mode: isRetainer ? "retainer" : "pre_retainer",
    brandDnaComplete,
    retainerKickoffSaid,
  };
}

/**
 * Section definitions for the portal menu, with retainer-mode gating.
 * Pre-retainer portals only see: Chat, Deliverables, Brand DNA.
 * Retainer portals see all sections.
 */
export const PORTAL_SECTIONS = [
  { key: "chat", label: "Chat", eyebrow: "Home", description: "Ask me anything", preRetainer: true },
  { key: "deliverables", label: "Deliverables", eyebrow: "Your work", description: "Photos, video, and tasks", preRetainer: true },
  { key: "invoices", label: "Invoices", eyebrow: "Finance", description: "Payments and statements", preRetainer: false },
  { key: "brand-dna", label: "Brand DNA", eyebrow: "Identity", description: "Your brand profile", preRetainer: true },
  { key: "package", label: "Package", eyebrow: "Your plan", description: "Subscription and billing", preRetainer: false },
  { key: "messages", label: "Messages", eyebrow: "Comms", description: "Thread with Andy", preRetainer: false },
  { key: "gallery", label: "Gallery", eyebrow: "Media", description: "Your photos and video", preRetainer: true },
  { key: "plan", label: "Your Plan", eyebrow: "Strategy", description: "Your 6-week marketing plan", preRetainer: true },
  { key: "data-export", label: "Download My Data", eyebrow: "Privacy", description: "Export everything", preRetainer: false },
] as const;

export type PortalSectionKey = (typeof PORTAL_SECTIONS)[number]["key"];
