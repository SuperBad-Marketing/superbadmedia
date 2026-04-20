import { db } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";

const MELBOURNE_LAT = -37.8136;
const MELBOURNE_LON = 144.9631;
const CACHE_TTL_MS = 15 * 60 * 1000;

let cachedResult: { precipitationMm: number; fetchedAt: number } | null = null;

export async function getMelbournePrecipitation(): Promise<number | null> {
  if (cachedResult && Date.now() - cachedResult.fetchedAt < CACHE_TTL_MS) {
    return cachedResult.precipitationMm;
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${MELBOURNE_LAT}&longitude=${MELBOURNE_LON}&current=precipitation&timezone=Australia%2FMelbourne`;

  try {
    const startMs = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    await db.insert(external_call_log).values({
      id: crypto.randomUUID(),
      job: "sd-melbourne-weather",
      actor_type: "internal",
      units: JSON.stringify({ api_calls: 1 }),
      estimated_cost_aud: 0,
      created_at_ms: Date.now(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      current?: { precipitation?: number };
    };

    const mm = data.current?.precipitation ?? 0;
    cachedResult = { precipitationMm: mm, fetchedAt: Date.now() };
    return mm;
  } catch {
    return null;
  }
}
