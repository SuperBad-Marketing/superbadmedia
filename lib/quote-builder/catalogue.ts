/**
 * Catalogue CRUD helpers for Quote Builder settings surface (§4.6).
 * Thin layer over the `catalogue_items` table: list (excluding soft-deleted
 * by default), create, update, soft-delete, hard-delete.
 *
 * Snapshot-on-add means deleting or repricing catalogue rows is safe for
 * in-flight quotes — the quote row carries its own `catalogue_snapshot_json`
 * (§5.2). So the CRUD surface is not load-bearing for quote integrity.
 */
import { and, asc, eq, isNull } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";
import {
  catalogue_items,
  type CatalogueItemRow,
  type CatalogueItemUnit,
} from "@/lib/db/schema/catalogue-items";

type DatabaseLike = typeof defaultDb;

function newId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `cat_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type CatalogueItemInput = {
  name: string;
  category: string;
  unit: CatalogueItemUnit;
  base_price_cents_inc_gst: number;
  tier_rank: number | null;
  description: string | null;
};

export function listCatalogueItems(
  options?: { includeDeleted?: boolean },
  dbOverride?: DatabaseLike,
): CatalogueItemRow[] {
  const database = dbOverride ?? defaultDb;
  const rows = database
    .select()
    .from(catalogue_items)
    .where(options?.includeDeleted ? undefined : isNull(catalogue_items.deleted_at_ms))
    .orderBy(asc(catalogue_items.category), asc(catalogue_items.name))
    .all();
  return rows;
}

export function getCatalogueItem(
  id: string,
  dbOverride?: DatabaseLike,
): CatalogueItemRow | null {
  const database = dbOverride ?? defaultDb;
  const row = database
    .select()
    .from(catalogue_items)
    .where(eq(catalogue_items.id, id))
    .get();
  return row ?? null;
}

export class CatalogueValidationError extends Error {}

function validate(input: CatalogueItemInput): void {
  if (!input.name.trim()) throw new CatalogueValidationError("Name required.");
  if (!input.category.trim()) throw new CatalogueValidationError("Category required.");
  if (!Number.isFinite(input.base_price_cents_inc_gst) || input.base_price_cents_inc_gst < 0) {
    throw new CatalogueValidationError("Price must be a non-negative integer.");
  }
  if (input.tier_rank != null && (!Number.isInteger(input.tier_rank) || input.tier_rank < 0)) {
    throw new CatalogueValidationError("Tier rank must be a non-negative integer.");
  }
}

export function createCatalogueItem(
  input: CatalogueItemInput,
  dbOverride?: DatabaseLike,
): CatalogueItemRow {
  validate(input);
  const database = dbOverride ?? defaultDb;
  const now = Date.now();
  const id = newId();
  database.insert(catalogue_items)
    .values({
      id,
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit,
      base_price_cents_inc_gst: Math.round(input.base_price_cents_inc_gst),
      tier_rank: input.tier_rank,
      description: input.description?.trim() || null,
      created_at_ms: now,
      updated_at_ms: now,
      deleted_at_ms: null,
    })
    .run();
  const row = getCatalogueItem(id, database);
  if (!row) throw new Error("Failed to read back inserted catalogue item.");
  return row;
}

export function updateCatalogueItem(
  id: string,
  input: CatalogueItemInput,
  dbOverride?: DatabaseLike,
): CatalogueItemRow {
  validate(input);
  const database = dbOverride ?? defaultDb;
  const existing = getCatalogueItem(id, database);
  if (!existing) throw new CatalogueValidationError("Catalogue item not found.");
  if (existing.deleted_at_ms != null) {
    throw new CatalogueValidationError("Cannot edit a deleted catalogue item.");
  }
  database.update(catalogue_items)
    .set({
      name: input.name.trim(),
      category: input.category.trim(),
      unit: input.unit,
      base_price_cents_inc_gst: Math.round(input.base_price_cents_inc_gst),
      tier_rank: input.tier_rank,
      description: input.description?.trim() || null,
      updated_at_ms: Date.now(),
    })
    .where(eq(catalogue_items.id, id))
    .run();
  const row = getCatalogueItem(id, database);
  if (!row) throw new Error("Failed to read back updated catalogue item.");
  return row;
}

/** Soft delete — catalogue row is hidden from the picker but snapshot-on-add keeps existing quotes intact. */
export function softDeleteCatalogueItem(id: string, dbOverride?: DatabaseLike): void {
  const database = dbOverride ?? defaultDb;
  const existing = getCatalogueItem(id, database);
  if (!existing) throw new CatalogueValidationError("Catalogue item not found.");
  if (existing.deleted_at_ms != null) return;
  database.update(catalogue_items)
    .set({ deleted_at_ms: Date.now(), updated_at_ms: Date.now() })
    .where(and(eq(catalogue_items.id, id), isNull(catalogue_items.deleted_at_ms)))
    .run();
}

export function restoreCatalogueItem(id: string, dbOverride?: DatabaseLike): void {
  const database = dbOverride ?? defaultDb;
  const existing = getCatalogueItem(id, database);
  if (!existing) throw new CatalogueValidationError("Catalogue item not found.");
  if (existing.deleted_at_ms == null) return;
  database.update(catalogue_items)
    .set({ deleted_at_ms: null, updated_at_ms: Date.now() })
    .where(eq(catalogue_items.id, id))
    .run();
}
