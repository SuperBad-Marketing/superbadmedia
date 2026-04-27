"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import {
  listVerticals,
  createVertical,
  updateVertical,
  toggleVertical,
  deleteVertical,
} from "@/lib/lead-gen/vertical-rotation";
import type { SearchVerticalRow } from "@/lib/db/schema/search-verticals";

type ActionResult = { ok: true } | { ok: false; error: string };

const VERTICALS_PATH = "/lite/admin/lead-gen/verticals";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.id ?? "admin";
}

export async function listVerticalsAction(): Promise<SearchVerticalRow[]> {
  return listVerticals();
}

export async function createVerticalAction(input: {
  name: string;
  category: string;
  location: string;
  location_lat: number;
  location_lng: number;
  radius_km: number;
  country_code: string;
  standing_brief: string | null;
  weight: number;
}): Promise<ActionResult & { vertical?: SearchVerticalRow }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  if (!input.category.trim()) return { ok: false, error: "Category is required." };
  if (!input.location.trim()) return { ok: false, error: "Location is required." };

  const vertical = await createVertical({
    name: input.name.trim(),
    category: input.category.trim(),
    location: input.location.trim(),
    location_lat: input.location_lat,
    location_lng: input.location_lng,
    radius_km: input.radius_km,
    country_code: input.country_code,
    standing_brief: input.standing_brief?.trim() || null,
    weight: Math.max(1, Math.min(10, input.weight)),
    is_active: true,
  });

  revalidatePath(VERTICALS_PATH);
  return { ok: true, vertical };
}

export async function updateVerticalAction(
  id: string,
  input: {
    name?: string;
    category?: string;
    location?: string;
    location_lat?: number;
    location_lng?: number;
    radius_km?: number;
    country_code?: string;
    standing_brief?: string | null;
    weight?: number;
  },
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.category !== undefined) updates.category = input.category.trim();
  if (input.location !== undefined) updates.location = input.location.trim();
  if (input.location_lat !== undefined) updates.location_lat = input.location_lat;
  if (input.location_lng !== undefined) updates.location_lng = input.location_lng;
  if (input.radius_km !== undefined) updates.radius_km = input.radius_km;
  if (input.country_code !== undefined) updates.country_code = input.country_code;
  if (input.standing_brief !== undefined) updates.standing_brief = input.standing_brief?.trim() || null;
  if (input.weight !== undefined) updates.weight = Math.max(1, Math.min(10, input.weight));

  await updateVertical(id, updates);
  revalidatePath(VERTICALS_PATH);
  return { ok: true };
}

export async function toggleVerticalAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  await toggleVertical(id, active);
  revalidatePath(VERTICALS_PATH);
  return { ok: true };
}

export async function deleteVerticalAction(
  id: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  await deleteVertical(id);
  revalidatePath(VERTICALS_PATH);
  return { ok: true };
}
