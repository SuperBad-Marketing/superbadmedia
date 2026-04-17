/**
 * Onboarding state orchestrator — thin composition layer.
 *
 * Reads completion from constituent primitives. No dedicated onboarding
 * state table — state is derived at read time per spec §10.
 *
 * Retainer sequence: welcome → brand_dna → practical_setup → credentials
 * SaaS sequence:    welcome → brand_dna → revenue_segmentation → product_config → credentials
 *
 * Owner: OS-1.
 */
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import { user } from "@/lib/db/schema/user";

export type OnboardingAudience = "retainer" | "saas";

export type OnboardingStep =
  | "welcome"
  | "brand_dna"
  | "revenue_segmentation"
  | "product_config"
  | "practical_setup"
  | "credentials";

export interface OnboardingState {
  currentStep: OnboardingStep | "complete";
  completedSteps: OnboardingStep[];
  totalSteps: number;
  audience: OnboardingAudience;
}

/**
 * Practical setup wizard keys — retainer-only. Mapped to three wizard_completions
 * entries. Completion = all three have a row.
 */
const PRACTICAL_SETUP_WIZARD_KEYS = [
  "practical-contact-details",
  "practical-ad-accounts",
  "practical-content-archive",
] as const;

/**
 * Derive onboarding state from constituent primitives.
 * No writes, no side effects — pure read.
 */
export async function getOnboardingState(
  companyId: string,
  audience: OnboardingAudience,
): Promise<OnboardingState> {
  const completed: OnboardingStep[] = [];

  // ── 1. Welcome screen ──────────────────────────────────────────────
  const primaryContact = db
    .select({
      id: contacts.id,
      onboarding_welcome_seen_at_ms: contacts.onboarding_welcome_seen_at_ms,
    })
    .from(contacts)
    .where(and(eq(contacts.company_id, companyId), eq(contacts.is_primary, true)))
    .get();

  const welcomeSeen = primaryContact?.onboarding_welcome_seen_at_ms != null;
  if (welcomeSeen) completed.push("welcome");

  // ── 2. Brand DNA ───────────────────────────────────────────────────
  // Check for a current, completed profile linked to this company.
  // Spec §15.4: must check is_current + completed_at, not flow-specific.
  const bdProfile = primaryContact
    ? db
        .select({ id: brand_dna_profiles.id })
        .from(brand_dna_profiles)
        .where(
          and(
            eq(brand_dna_profiles.contact_id, primaryContact.id),
            eq(brand_dna_profiles.is_current, true),
            eq(brand_dna_profiles.status, "complete"),
            isNotNull(brand_dna_profiles.completed_at_ms),
          ),
        )
        .get()
    : null;

  const brandDnaDone = bdProfile != null;
  if (brandDnaDone) completed.push("brand_dna");

  // ── 3. Revenue Segmentation (SaaS only) ────────────────────────────
  let revSegDone = false;
  if (audience === "saas") {
    const co = db
      .select({
        revenue_segmentation_completed_at_ms:
          companies.revenue_segmentation_completed_at_ms,
      })
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    revSegDone = co?.revenue_segmentation_completed_at_ms != null;
    if (revSegDone) completed.push("revenue_segmentation");
  }

  // ── 4. Product config (SaaS only) ─────────────────────────────────
  // Product config completion is product-specific. For v1, we check
  // wizard_completions for the product's config wizard key. This is
  // a forward reference — product specs will register their wizard key.
  // For now, product_config is considered done if any product-config
  // wizard completion exists for this user. OS-2 refines this.
  let productConfigDone = false;
  if (audience === "saas" && primaryContact) {
    // Placeholder: product config wizard completion check.
    // Each SaaS product declares a wizard key like "config-content-engine".
    // Until those exist, product_config is not blocking.
    productConfigDone = false;
  }
  if (productConfigDone) completed.push("product_config");

  // ── 5. Practical setup (retainer only) ─────────────────────────────
  let practicalSetupDone = false;
  if (audience === "retainer" && primaryContact) {
    const completedWizards = db
      .select({ wizard_key: wizard_completions.wizard_key })
      .from(wizard_completions)
      .where(eq(wizard_completions.user_id, primaryContact.id))
      .all();

    const completedKeys = new Set(completedWizards.map((r) => r.wizard_key));
    practicalSetupDone = PRACTICAL_SETUP_WIZARD_KEYS.every((k) =>
      completedKeys.has(k),
    );
    if (practicalSetupDone) completed.push("practical_setup");
  }

  // ── 6. Credentials ────────────────────────────────────────────────
  // A user record with verified email exists for this contact's email.
  let credentialsDone = false;
  if (primaryContact) {
    const contactEmail = db
      .select({ email: contacts.email })
      .from(contacts)
      .where(eq(contacts.id, primaryContact.id))
      .get()?.email;

    if (contactEmail) {
      const userRow = db
        .select({ id: user.id })
        .from(user)
        .where(
          and(eq(user.email, contactEmail), isNotNull(user.emailVerified)),
        )
        .get();
      credentialsDone = userRow != null;
    }
  }
  if (credentialsDone) completed.push("credentials");

  // ── Build sequence + find current step ────────────────────────────
  const sequence: OnboardingStep[] =
    audience === "retainer"
      ? ["welcome", "brand_dna", "practical_setup", "credentials"]
      : [
          "welcome",
          "brand_dna",
          "revenue_segmentation",
          "product_config",
          "credentials",
        ];

  const currentStep: OnboardingStep | "complete" =
    sequence.find((step) => !completed.includes(step)) ?? "complete";

  return {
    currentStep,
    completedSteps: completed,
    totalSteps: sequence.length,
    audience,
  };
}
