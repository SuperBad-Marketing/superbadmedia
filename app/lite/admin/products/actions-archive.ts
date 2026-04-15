"use server";

/**
 * SB-2c — archive / un-archive actions for SaaS products.
 * Spec: docs/specs/saas-subscription-billing.md §8.3, §8.4.
 *
 * Archive: single txn flips `active→archived` + writes activity_log;
 * outside the txn, calls `archiveTierPrices(tierId)` per tier so Stripe
 * Prices flip to `active=false` (IDs preserved — historical subscribers
 * keep billing), then `syncProductToStripe(productId)` so the Stripe
 * Product also reads `active=false`. Stripe failure is logged but does
 * not roll back the local flip; the archive helpers are idempotent so
 * re-running the action cleans up.
 *
 * Un-archive: pure local flip `archived→active`. Stripe Prices stay
 * archived (immutable). UI copy calls this out per AC4.
 */
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { activity_log } from "@/lib/db/schema/activity-log";
import {
  archiveTierPrices,
  syncProductToStripe,
} from "@/lib/billing/stripe-product-sync";

export type ArchiveResult =
  | { ok: true; stripeSynced: boolean }
  | { ok: false; reason: string };

export async function archiveSaasProductAction(
  productId: string,
): Promise<ArchiveResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false, reason: "Admin access required." };
  }
  const actorId = session.user.id;

  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, productId))
    .limit(1);
  if (!product) {
    return { ok: false, reason: "Product not found." };
  }
  if (product.status !== "active") {
    return {
      ok: false,
      reason: "Only active products can be archived.",
    };
  }

  const tierRows = await db
    .select({ id: saas_tiers.id })
    .from(saas_tiers)
    .where(eq(saas_tiers.product_id, productId));

  const nowMs = Date.now();

  try {
    db.transaction((tx) => {
      tx.update(saas_products)
        .set({ status: "archived", updated_at_ms: nowMs })
        .where(eq(saas_products.id, productId))
        .run();
      tx.insert(activity_log)
        .values({
          id: randomUUID(),
          company_id: null,
          contact_id: null,
          deal_id: null,
          kind: "saas_product_archived",
          body: `SaaS product archived: ${product.name} (${product.slug}).`,
          meta: {
            product_id: productId,
            slug: product.slug,
            tier_count: tierRows.length,
          },
          created_at_ms: nowMs,
          created_by: actorId,
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Couldn't archive: ${message}` };
  }

  // Stripe catch-up. Failures log but don't roll back; the helpers are
  // idempotent so a retry (manual or via re-archive) cleans up.
  let stripeSynced = true;
  try {
    for (const t of tierRows) {
      await archiveTierPrices(t.id);
    }
    await syncProductToStripe(productId);
  } catch (err) {
    stripeSynced = false;
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(activity_log).values({
      id: randomUUID(),
      company_id: null,
      contact_id: null,
      deal_id: null,
      kind: "note",
      body: "SaaS product archive: Stripe sync failed — local status archived.",
      meta: {
        kind: "saas_product_archive_stripe_failed",
        product_id: productId,
        error_message: message,
      },
      created_at_ms: Date.now(),
      created_by: actorId,
    });
  }

  revalidatePath("/lite/admin/products");
  revalidatePath(`/lite/admin/products/${productId}`);

  return { ok: true, stripeSynced };
}

export type UnarchiveResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function unarchiveSaasProductAction(
  productId: string,
): Promise<UnarchiveResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false, reason: "Admin access required." };
  }
  const actorId = session.user.id;

  const [product] = await db
    .select()
    .from(saas_products)
    .where(eq(saas_products.id, productId))
    .limit(1);
  if (!product) {
    return { ok: false, reason: "Product not found." };
  }
  if (product.status !== "archived") {
    return {
      ok: false,
      reason: "Only archived products can be un-archived.",
    };
  }

  const nowMs = Date.now();

  try {
    db.transaction((tx) => {
      tx.update(saas_products)
        .set({ status: "active", updated_at_ms: nowMs })
        .where(eq(saas_products.id, productId))
        .run();
      tx.insert(activity_log)
        .values({
          id: randomUUID(),
          company_id: null,
          contact_id: null,
          deal_id: null,
          kind: "note",
          body: `SaaS product un-archived: ${product.name} (${product.slug}).`,
          meta: {
            kind: "saas_product_unarchived",
            product_id: productId,
            slug: product.slug,
          },
          created_at_ms: nowMs,
          created_by: actorId,
        })
        .run();
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Couldn't un-archive: ${message}` };
  }

  // Stripe Product gets flipped back to active=true by syncProductToStripe
  // (which reads `status === "active"`). Prices stay archived (immutable) —
  // spec §8.4 + AC4 UI copy explains this to Andy.
  try {
    await syncProductToStripe(productId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.insert(activity_log).values({
      id: randomUUID(),
      company_id: null,
      contact_id: null,
      deal_id: null,
      kind: "note",
      body: "SaaS product un-archive: Stripe sync failed — local status active.",
      meta: {
        kind: "saas_product_unarchive_stripe_failed",
        product_id: productId,
        error_message: message,
      },
      created_at_ms: Date.now(),
      created_by: actorId,
    });
  }

  revalidatePath("/lite/admin/products");
  revalidatePath(`/lite/admin/products/${productId}`);

  return { ok: true };
}
