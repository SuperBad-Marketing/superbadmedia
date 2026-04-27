import { randomUUID } from "node:crypto";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { searchVerticals } from "@/lib/db/schema/search-verticals";
import type { SearchVerticalRow, SearchVerticalInsert } from "@/lib/db/schema/search-verticals";
import type { DiscoverySearchParams } from "./types";
import settings from "@/lib/settings";

export interface SelectedVertical {
  id: string;
  name: string;
  searchParams: DiscoverySearchParams;
}

/**
 * Pick the next vertical to search. Weighted least-recently-searched:
 * score = days_since_last_search * weight. Highest score wins.
 * Never-searched verticals get max priority (score = Infinity).
 */
export async function getNextVertical(
  dbInstance = defaultDb,
): Promise<SelectedVertical | null> {
  const actives = await dbInstance
    .select()
    .from(searchVerticals)
    .where(eq(searchVerticals.is_active, true))
    .all();

  if (actives.length === 0) return null;

  const now = Date.now();

  const scored = actives.map((v) => {
    if (!v.last_searched_at) {
      return { vertical: v, score: Infinity };
    }
    const daysSince = (now - v.last_searched_at.getTime()) / (1000 * 60 * 60 * 24);
    return { vertical: v, score: daysSince * v.weight };
  });

  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0].vertical;

  const maxPerDay = await settings.get("lead_generation.daily_max_per_day");
  const brief = winner.standing_brief ??
    await settings.get("lead_generation.standing_brief");

  return {
    id: winner.id,
    name: winner.name,
    searchParams: {
      category: winner.category,
      location: winner.location,
      radius_km: winner.radius_km,
      location_lat: winner.location_lat,
      location_lng: winner.location_lng,
      country_code: winner.country_code,
      brief,
      max_candidates: maxPerDay * 3,
    },
  };
}

export async function recordVerticalSearch(
  verticalId: string,
  dbInstance = defaultDb,
): Promise<void> {
  await dbInstance
    .update(searchVerticals)
    .set({
      last_searched_at: new Date(),
      search_count: sql`${searchVerticals.search_count} + 1`,
    })
    .where(eq(searchVerticals.id, verticalId));
}

export async function listVerticals(
  dbInstance = defaultDb,
): Promise<SearchVerticalRow[]> {
  return dbInstance
    .select()
    .from(searchVerticals)
    .orderBy(asc(searchVerticals.name))
    .all();
}

export async function createVertical(
  input: Omit<SearchVerticalInsert, "id" | "created_at" | "search_count" | "last_searched_at">,
  dbInstance = defaultDb,
): Promise<SearchVerticalRow> {
  const id = randomUUID();
  const [row] = await dbInstance
    .insert(searchVerticals)
    .values({ ...input, id })
    .returning();
  return row;
}

export async function updateVertical(
  id: string,
  input: Partial<Omit<SearchVerticalInsert, "id" | "created_at">>,
  dbInstance = defaultDb,
): Promise<void> {
  await dbInstance
    .update(searchVerticals)
    .set(input)
    .where(eq(searchVerticals.id, id));
}

export async function toggleVertical(
  id: string,
  active: boolean,
  dbInstance = defaultDb,
): Promise<void> {
  await dbInstance
    .update(searchVerticals)
    .set({ is_active: active })
    .where(eq(searchVerticals.id, id));
}

export async function deleteVertical(
  id: string,
  dbInstance = defaultDb,
): Promise<void> {
  await dbInstance
    .delete(searchVerticals)
    .where(eq(searchVerticals.id, id));
}
