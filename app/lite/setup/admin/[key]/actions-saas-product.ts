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
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_usage_dimensions } from "@/lib/db/schema/saas-usage-dimensions";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  saasProductNameSlugSchema,
  validateDimensions,
  SAAS_PRODUCT_SLUG_REGEX,
  type SaasProductDimension,
} from "@/lib/wizards/defs/saas-product-setup";

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
