"use server";

/**
 * Server Actions for the `saas-product-setup` wizard (SB-2a slice).
 *
 * Two actions for SB-2a:
 *  - `checkSaasProductSlugAction(slug)` — live uniqueness feedback for the
 *    name-and-slug form step. Runs Zod shape-check + DB lookup.
 *  - `persistSaasProductDraftAction(payload)` — inside one transaction:
 *    re-check slug uniqueness, insert `saas_products` (status=draft),
 *    insert each `saas_usage_dimensions` row, and write an
 *    `activity_log` kind=`saas_product_created`. Returns `{productId}` so
 *    the wizard shell can resume against it in SB-2b.
 *
 * SB-2b adds the publish action.
 *
 * Owner: SB-2a. Spec: docs/specs/saas-subscription-billing.md §8.1, §8.2.
 */
import { randomUUID, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_usage_dimensions } from "@/lib/db/schema/saas-usage-dimensions";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { saas_tier_limits } from "@/lib/db/schema/saas-tier-limits";
import { activity_log } from "@/lib/db/schema/activity-log";
import { wizard_completions } from "@/lib/db/schema/wizard-completions";
import {
  saasProductNameSlugSchema,
  saasProductSetupWizard,
  validateDimensions,
  SAAS_PRODUCT_SLUG_REGEX,
  type SaasProductDimension,
} from "@/lib/wizards/defs/saas-product-setup";
import {
  syncProductToStripe,
  syncTierPricesToStripe,
} from "@/lib/billing/stripe-product-sync";

export type SlugCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function checkSaasProductSlugAction(
  slug: string,
): Promise<SlugCheckResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false, reason: "Admin access required." };
  }
  const trimmed = (slug ?? "").trim();
  if (trimmed.length < 2) {
    return { ok: false, reason: "Slug needs at least two characters." };
  }
  if (!SAAS_PRODUCT_SLUG_REGEX.test(trimmed)) {
    return {
      ok: false,
      reason: "Slug is lowercase letters, numbers, and dashes only.",
    };
  }
  const existing = await db
    .select({ id: saas_products.id })
    .from(saas_products)
    .where(eq(saas_products.slug, trimmed))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, reason: "That slug is already in use." };
  }
  return { ok: true };
}

export type PersistDraftInput = {
  name: string;
  description: string | null;
  slug: string;
  dimensions: Array<{ key: string; displayName: string }>;
};

export type PersistDraftResult =
  | { ok: true; productId: string }
  | { ok: false; reason: string };

export async function persistSaasProductDraftAction(
  input: PersistDraftInput,
): Promise<PersistDraftResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false, reason: "Admin access required." };
  }
  const actorId = session.user.id;

  // Shape-check top-level fields with the same schema the form step uses.
  const shapeResult = saasProductNameSlugSchema.safeParse({
    name: input.name,
    description: input.description ?? "",
    slug: input.slug,
  });
  if (!shapeResult.success) {
    return {
      ok: false,
      reason: shapeResult.error.issues[0]?.message ?? "Invalid product fields.",
    };
  }

  const dims: SaasProductDimension[] = (input.dimensions ?? []).map((d, i) => ({
    tempId: `d${i}`,
    key: (d.key ?? "").trim(),
    displayName: (d.displayName ?? "").trim(),
  }));
  const dimsResult = validateDimensions(dims);
  if (!dimsResult.ok) return dimsResult;

  const slug = shapeResult.data.slug;
  const name = shapeResult.data.name;
  const description = shapeResult.data.description.length > 0
    ? shapeResult.data.description
    : null;

  try {
    const productId = randomUUID();

    db.transaction((tx) => {
      // Race-safe slug recheck inside the transaction.
      const clash = tx
        .select({ id: saas_products.id })
        .from(saas_products)
        .where(eq(saas_products.slug, slug))
        .limit(1)
        .all();
      if (clash.length > 0) {
        throw new Error("slug-conflict");
      }

      // Compute display_order = max + 1 (or 0 for the first row).
      const existing = tx
        .select({ display_order: saas_products.display_order })
        .from(saas_products)
        .all();
      const nextOrder = existing.length === 0
        ? 0
        : Math.max(...existing.map((r) => r.display_order)) + 1;

      const nowMs = Date.now();

      tx.insert(saas_products)
        .values({
          id: productId,
          name,
          description,
          slug,
          status: "draft",
          demo_enabled: false,
          demo_config: null,
          menu_config: null,
          product_config_schema: null,
          stripe_product_id: null,
          display_order: nextOrder,
          created_at_ms: nowMs,
          updated_at_ms: nowMs,
        })
        .run();

      dims.forEach((d, index) => {
        tx.insert(saas_usage_dimensions)
          .values({
            id: randomUUID(),
            product_id: productId,
            dimension_key: d.key,
            display_name: d.displayName,
            display_order: index,
            created_at_ms: nowMs,
          })
          .run();
      });

      tx.insert(activity_log)
        .values({
          id: randomUUID(),
          company_id: null,
          contact_id: null,
          deal_id: null,
          kind: "saas_product_created",
          body: `SaaS product draft created: ${name} (${slug}).`,
          meta: {
            product_id: productId,
            slug,
            dimension_count: dims.length,
          },
          created_at_ms: nowMs,
          created_by: actorId,
        })
        .run();
    });

    return { ok: true, productId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "slug-conflict") {
      return { ok: false, reason: "That slug is already in use." };
    }
    return {
      ok: false,
      reason: "Couldn't save the draft. Try again.",
    };
  }
}

// --------------------------------------------------------------------------
// publishSaasProductAction — SB-2b
// --------------------------------------------------------------------------

export type PublishTierInput = {
  tierRank: 1 | 2 | 3;
  name: string;
  monthlyCents: number;
  setupFeeCents: number;
  featureFlags: Record<string, boolean>;
  /** One per dimension declared on the product. `value = null` = unlimited. */
  limits: Array<{ dimensionKey: string; value: number | null }>;
};

export type PublishSaasProductInput = {
  productId: string;
  tiers: PublishTierInput[];
  demo: { enabled: boolean; config: Record<string, unknown> };
};

export type PublishSaasProductResult =
  | { ok: true; observatorySummary: string }
  | { ok: false; reason: string };

function publishContractVersion(): string {
  const keys = saasProductSetupWizard.completionContract.required
    .map((k) => String(k))
    .sort();
  return createHash("sha256")
    .update(
      JSON.stringify({ key: saasProductSetupWizard.key, required: keys }),
    )
    .digest("hex")
    .slice(0, 16);
}

async function revertProductToDraft(
  productId: string,
  errorMessage: string,
  actorId: string,
): Promise<void> {
  const nowMs = Date.now();
  await db
    .update(saas_products)
    .set({ status: "draft", updated_at_ms: nowMs })
    .where(eq(saas_products.id, productId));
  await db.insert(activity_log).values({
    id: randomUUID(),
    company_id: null,
    contact_id: null,
    deal_id: null,
    kind: "note",
    body: `SaaS product publish failed at Stripe sync; reverted to draft.`,
    meta: {
      kind: "saas_product_publish_stripe_failed",
      product_id: productId,
      error_message: errorMessage,
    },
    created_at_ms: nowMs,
    created_by: actorId,
  });
}

export async function publishSaasProductAction(
  input: PublishSaasProductInput,
): Promise<PublishSaasProductResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false, reason: "Admin access required." };
  }
  const actorId = session.user.id;

  // Basic payload sanity.
  if (!input.productId) {
    return { ok: false, reason: "Missing productId." };
  }
  if (!Array.isArray(input.tiers) || input.tiers.length !== 3) {
    return { ok: false, reason: "Three tiers required." };
  }
  const ranks = input.tiers.map((t) => t.tierRank).sort();
  if (ranks.join(",") !== "1,2,3") {
    return { ok: false, reason: "Tier ranks must be 1, 2, 3." };
  }
  for (const t of input.tiers) {
    if (!t.name.trim()) {
      return { ok: false, reason: `Tier ${t.tierRank} is missing a name.` };
    }
    if (!Number.isInteger(t.monthlyCents) || t.monthlyCents <= 0) {
      return {
        ok: false,
        reason: `Tier ${t.tierRank} needs a monthly price above zero.`,
      };
    }
    if (!Number.isInteger(t.setupFeeCents) || t.setupFeeCents < 0) {
      return {
        ok: false,
        reason: `Tier ${t.tierRank} setup fee can't be negative.`,
      };
    }
  }

  // Look up the draft product + its dimensions for key→id mapping.
  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, input.productId))
    .limit(1);
  if (!product) {
    return { ok: false, reason: "Product not found." };
  }
  if (product.status !== "draft") {
    return {
      ok: false,
      reason: "Only draft products can be published.",
    };
  }

  const dimensionRows = await db
    .select()
    .from(saas_usage_dimensions)
    .where(eq(saas_usage_dimensions.product_id, input.productId));
  const dimensionByKey = new Map(
    dimensionRows.map((d) => [d.dimension_key, d]),
  );

  // Pre-compute tier inserts + limit inserts with resolved dimension_ids.
  const tierIdsByRank = new Map<1 | 2 | 3, string>();
  const nowMs = Date.now();
  type LimitInsert = {
    id: string;
    tier_id: string;
    dimension_id: string;
    limit_value: number | null;
  };
  const limitInserts: LimitInsert[] = [];
  const tierInserts: Array<{
    id: string;
    product_id: string;
    name: string;
    tier_rank: number;
    monthly_price_cents_inc_gst: number;
    setup_fee_cents_inc_gst: number;
    feature_flags: Record<string, boolean>;
    stripe_monthly_price_id: string | null;
    stripe_annual_price_id: string | null;
    stripe_upfront_price_id: string | null;
    created_at_ms: number;
    updated_at_ms: number;
  }> = [];

  for (const t of input.tiers) {
    const tierId = randomUUID();
    tierIdsByRank.set(t.tierRank, tierId);
    tierInserts.push({
      id: tierId,
      product_id: input.productId,
      name: t.name.trim(),
      tier_rank: t.tierRank,
      monthly_price_cents_inc_gst: t.monthlyCents,
      setup_fee_cents_inc_gst: t.setupFeeCents,
      feature_flags: t.featureFlags,
      stripe_monthly_price_id: null,
      stripe_annual_price_id: null,
      stripe_upfront_price_id: null,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    });
    for (const lim of t.limits) {
      const dim = dimensionByKey.get(lim.dimensionKey);
      if (!dim) {
        return {
          ok: false,
          reason: `Unknown dimension "${lim.dimensionKey}" on tier ${t.tierRank}.`,
        };
      }
      if (lim.value !== null && (!Number.isInteger(lim.value) || lim.value < 0)) {
        return {
          ok: false,
          reason: "Limits must be non-negative integers or unlimited.",
        };
      }
      limitInserts.push({
        id: randomUUID(),
        tier_id: tierId,
        dimension_id: dim.id,
        limit_value: lim.value,
      });
    }
  }

  // Single transaction: tiers + tier_limits + status flip + activity log.
  try {
    db.transaction((tx) => {
      for (const row of tierInserts) {
        tx.insert(saas_tiers).values(row).run();
      }
      for (const row of limitInserts) {
        tx.insert(saas_tier_limits).values(row).run();
      }
      tx.update(saas_products)
        .set({
          status: "active",
          demo_enabled: input.demo.enabled,
          demo_config: input.demo.config ?? null,
          updated_at_ms: nowMs,
        })
        .where(eq(saas_products.id, input.productId))
        .run();
      tx.insert(activity_log)
        .values({
          id: randomUUID(),
          company_id: null,
          contact_id: null,
          deal_id: null,
          kind: "saas_product_published",
          body: `SaaS product published: ${product.name} (${product.slug}).`,
          meta: {
            product_id: input.productId,
            slug: product.slug,
            tier_count: tierInserts.length,
          },
          created_at_ms: nowMs,
          created_by: actorId,
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Couldn't publish: ${message}` };
  }

  // Stripe sync — outside the transaction. Failure reverts.
  try {
    await syncProductToStripe(input.productId);
    for (const t of input.tiers) {
      const tierId = tierIdsByRank.get(t.tierRank);
      if (!tierId) continue;
      await syncTierPricesToStripe(tierId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await revertProductToDraft(input.productId, message, actorId);
    return {
      ok: false,
      reason: `Stripe sync failed — product reverted to draft. ${message}`,
    };
  }

  // wizard_completions — mirrors actions-pixieset pattern. Use the first
  // dimension row for the dimensions completion-payload mirror.
  const dimensionsPayload = dimensionRows
    .sort((a, b) => a.display_order - b.display_order)
    .map((d) => ({ key: d.dimension_key, displayName: d.display_name }));

  await db.insert(wizard_completions).values({
    id: randomUUID(),
    wizard_key: saasProductSetupWizard.key,
    user_id: actorId,
    audience: "admin",
    completion_payload: {
      productId: input.productId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      dimensions: dimensionsPayload,
      publishedAt: nowMs,
    },
    contract_version: publishContractVersion(),
    completed_at_ms: nowMs,
  });

  return {
    ok: true,
    observatorySummary: `Product live: ${product.name} (3 tiers, ${dimensionRows.length} dimension${dimensionRows.length === 1 ? "" : "s"}).`,
  };
}

