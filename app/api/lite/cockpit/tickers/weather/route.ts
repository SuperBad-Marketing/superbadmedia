import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getCredential } from "@/lib/integrations/getCredential";

const MELBOURNE_LAT = -37.8136;
const MELBOURNE_LON = 144.9631;
const CACHE_TTL_MS = 900000;

let cache: { data: unknown; fetchedAt: number } | null = null;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const apiKey = await getCredential("openweather");
  if (!apiKey) {
    return NextResponse.json(
      { temp: 18, feelsLike: 16, condition: "Partly cloudy", uv: 4, rainChance: 30 },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${MELBOURNE_LAT}&lon=${MELBOURNE_LON}&units=metric&exclude=minutely,hourly,alerts&appid=${apiKey}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { temp: 18, feelsLike: 16, condition: "Unknown", uv: 0, rainChance: 0 },
      );
    }

    const json = await res.json();
    const current = json.current;
    const daily = json.daily?.[0];

    const data = {
      temp: Math.round(current.temp),
      feelsLike: Math.round(current.feels_like),
      condition: current.weather?.[0]?.description ?? "Unknown",
      uv: Math.round(current.uvi ?? 0),
      rainChance: daily?.pop ? Math.round(daily.pop * 100) : 0,
    };

    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { temp: 18, feelsLike: 16, condition: "Unavailable", uv: 0, rainChance: 0 },
    );
  }
}
