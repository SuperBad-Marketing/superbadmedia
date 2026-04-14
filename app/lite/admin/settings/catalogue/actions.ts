"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  createCatalogueItem,
  updateCatalogueItem,
  softDeleteCatalogueItem,
  restoreCatalogueItem,
  CatalogueValidationError,
  type CatalogueItemInput,
} from "@/lib/quote-builder/catalogue";
import {
  CATALOGUE_ITEM_UNITS,
  type CatalogueItemUnit,
} from "@/lib/db/schema/catalogue-items";

type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requireAdmin(): Promise<boolean> {
  const session = await auth();
  return !!session?.user && session.user.role === "admin";
}

function coerceInput(raw: {
  name: string;
  category: string;
  unit: string;
  base_price_cents_inc_gst: number;
  tier_rank: number | null;
  description: string | null;
}): CatalogueItemInput | { error: string } {
  if (!CATALOGUE_ITEM_UNITS.includes(raw.unit as CatalogueItemUnit)) {
    return { error: "Unknown unit." };
  }
  return {
    name: raw.name,
    category: raw.category,
    unit: raw.unit as CatalogueItemUnit,
    base_price_cents_inc_gst: raw.base_price_cents_inc_gst,
    tier_rank: raw.tier_rank,
    description: raw.description,
  };
}

function revalidate() {
  revalidatePath("/lite/admin/settings/catalogue");
  // The editor catalogue picker reads the same rows on every draft.
  revalidatePath("/lite/admin/deals", "layout");
}

export async function createCatalogueItemAction(raw: {
  name: string;
  category: string;
  unit: string;
  base_price_cents_inc_gst: number;
  tier_rank: number | null;
  description: string | null;
}): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  const parsed = coerceInput(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    const row = createCatalogueItem(parsed);
    revalidate();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof CatalogueValidationError
          ? err.message
          : "Could not create item.",
    };
  }
}

export async function updateCatalogueItemAction(
  id: string,
  raw: {
    name: string;
    category: string;
    unit: string;
    base_price_cents_inc_gst: number;
    tier_rank: number | null;
    description: string | null;
  },
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  const parsed = coerceInput(raw);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    updateCatalogueItem(id, parsed);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof CatalogueValidationError
          ? err.message
          : "Could not update item.",
    };
  }
}

export async function softDeleteCatalogueItemAction(
  id: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  try {
    softDeleteCatalogueItem(id);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof CatalogueValidationError
          ? err.message
          : "Could not delete item.",
    };
  }
}

export async function restoreCatalogueItemAction(
  id: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Not authorised." };
  try {
    restoreCatalogueItem(id);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof CatalogueValidationError
          ? err.message
          : "Could not restore item.",
    };
  }
}
