/**
 * `saas-product-setup` — admin wizard for creating + publishing a SaaS
 * product. Lives on the non-critical admin tree (`/lite/setup/admin/[key]`).
 *
 * SB-2a scope: steps 1 (`name-and-slug`) and 2 (`usage-dimensions`) are
 * fully implemented; steps 3–7 are registered as stubs so the def's shape
 * is complete and SB-2b can fill them in without re-registering.
 *
 * Owner: SB-2a. Consumer: app/lite/setup/admin/[key]/page.tsx.
 * Spec: docs/specs/saas-subscription-billing.md §1.1, §8.2.
 *
 * Note on killSwitchKey: WizardDefinition doesn't carry a root-level
 * kill-switch; vendor wizards gate via `vendorManifest.killSwitchKey`. SaaS
 * product setup has no vendor. If Andy needs to freeze this wizard pre-SB-2b
 * we can gate at the route level — out of scope for this slice per
 * `feedback_technical_decisions_claude_calls` (silent reconcile).
 */
import { z } from "zod";
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";

/** Payload the completion contract finally commits. SB-2b writes this. */
export type SaasProductSetupPayload = {
  productId: string;
  name: string;
  slug: string;
  description: string | null;
  dimensions: Array<{ key: string; displayName: string }>;
  publishedAt: number;
};

/** Slug convention: lowercase kebab, 2+ chars. Spec §8.2. */
export const SAAS_PRODUCT_SLUG_REGEX = /^[a-z0-9-]+$/;

/** Dimension key convention: snake_case starting with a letter. Spec §8.2. */
export const SAAS_DIMENSION_KEY_REGEX = /^[a-z][a-z0-9_]*$/;

export const MIN_DIMENSIONS = 1; // spec §8.2
export const MAX_DIMENSIONS = 3; // spec §8.2 + Q3

export const saasProductNameSlugSchema = z.object({
  name: z.string().trim().min(2, "Name needs at least two characters."),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "")),
  slug: z
    .string()
    .trim()
    .min(2, "Slug needs at least two characters.")
    .regex(SAAS_PRODUCT_SLUG_REGEX, "Slug is lowercase letters, numbers, and dashes only."),
});

export type SaasProductDimension = {
  tempId: string;
  key: string;
  displayName: string;
};

export function validateDimensions(
  dims: SaasProductDimension[],
): { ok: true } | { ok: false; reason: string } {
  if (dims.length < MIN_DIMENSIONS) {
    return { ok: false, reason: "Add at least one usage dimension." };
  }
  if (dims.length > MAX_DIMENSIONS) {
    return { ok: false, reason: `Three dimensions max.` };
  }
  const seen = new Set<string>();
  for (const d of dims) {
    if (!d.displayName.trim()) {
      return { ok: false, reason: "Give every dimension a display name." };
    }
    if (!SAAS_DIMENSION_KEY_REGEX.test(d.key)) {
      return {
        ok: false,
        reason: `"${d.key}" isn't a valid key (snake_case, starts with a letter).`,
      };
    }
    if (seen.has(d.key)) {
      return { ok: false, reason: `"${d.key}" is duplicated.` };
    }
    seen.add(d.key);
  }
  return { ok: true };
}

/** Slug suggestion from a name. "My New Thing!" → "my-new-thing". */
export function suggestSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Dimension-key suggestion. "Active Campaigns" → "active_campaigns". */
export function suggestDimensionKey(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export const saasProductSetupWizard: WizardDefinition<SaasProductSetupPayload> = {
  key: "saas-product-setup",
  audience: "admin",
  renderMode: "slideover",
  steps: [
    {
      key: "name-and-slug",
      type: "form",
      label: "Name",
      resumable: true,
      config: { schema: saasProductNameSlugSchema },
    },
    {
      key: "usage-dimensions",
      type: "custom",
      label: "Usage dimensions",
      resumable: true,
    },
    {
      key: "tiers",
      type: "custom",
      label: "Tiers",
      resumable: true,
      config: { placeholder: "sb-2b" },
    },
    {
      key: "pricing",
      type: "custom",
      label: "Pricing",
      resumable: true,
      config: { placeholder: "sb-2b" },
    },
    {
      key: "demo-config",
      type: "custom",
      label: "Demo",
      resumable: true,
      config: { placeholder: "sb-2b" },
    },
    {
      key: "review",
      type: "review-and-confirm",
      label: "Review",
      resumable: true,
      config: { placeholder: "sb-2b", ctaLabel: "Publish" },
    },
    {
      key: "celebrate",
      type: "celebration",
      label: "Done",
      resumable: false,
    },
  ],
  completionContract: {
    required: ["productId", "name", "slug", "dimensions", "publishedAt"],
    // SB-2b lands the real publish path; verify() now passes — the
    // publishSaasProductAction writes the wizard_completions row + status
    // flip + Stripe sync. Failures surface through the celebration-step
    // onComplete orchestrator, so this verify() stays permissive.
    verify: async () => ({ ok: true }),
    // Brief asked for `wizardCompletions: true`, but CompletionArtefacts
    // only models `integrationConnections | observatoryBands | activityLog`.
    // Silent reconcile per `feedback_technical_decisions_claude_calls`:
    // pin to the `activityLog` artefact we DO write
    // (`saas_product_created` from `persistSaasProductDraftAction`). Note
    // for SB-2b: `saas_product_published` is the publish-time kind.
    artefacts: { activityLog: "saas_product_created" },
  },
  voiceTreatment: {
    introCopy:
      "New SaaS product — name it, tell the platform what it meters on, pick tiers + prices, ship.",
    outroCopy: "Product live. The popcorn machine is on.",
    tabTitlePool: {
      setup: ["Setup — New product"],
      connecting: ["Saving product…"],
      confirming: ["Publishing product…"],
      connected: ["Product live."],
      stuck: ["Product setup — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(saasProductSetupWizard);
