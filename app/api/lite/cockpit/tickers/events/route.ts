import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";

const CACHE_TTL_MS = 1800000;
const FOOTBALL_DATA_BASE = "https://api.football-data.org/v4";

let cache: { data: unknown; fetchedAt: number } | null = null;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  const events: Array<{
    id: string;
    league: string;
    headline: string;
    detail: string;
    timestamp?: string;
  }> = [];

  const footballApiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (footballApiKey) {
    try {
      const eplEvents = await fetchNottmForest(footballApiKey);
      events.push(...eplEvents);
    } catch {
      // EPL data unavailable
    }
  }

  const data = { events };
  cache = { data, fetchedAt: Date.now() };
  return NextResponse.json(data);
}

async function fetchNottmForest(apiKey: string) {
  const events: Array<{
    id: string;
    league: string;
    headline: string;
    detail: string;
    timestamp?: string;
  }> = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(
      `${FOOTBALL_DATA_BASE}/teams/351/matches?status=SCHEDULED&limit=3`,
      {
        signal: controller.signal,
        headers: { "X-Auth-Token": apiKey },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) return events;

    const json = await res.json();
    const matches = json.matches ?? [];

    for (const match of matches.slice(0, 2)) {
      const home = match.homeTeam?.shortName ?? match.homeTeam?.name ?? "TBC";
      const away = match.awayTeam?.shortName ?? match.awayTeam?.name ?? "TBC";
      const date = match.utcDate
        ? new Date(match.utcDate).toLocaleDateString("en-AU", {
            timeZone: "Australia/Melbourne",
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "TBC";

      events.push({
        id: `epl_${match.id}`,
        league: "epl",
        headline: `${home} vs ${away}`,
        detail: date,
        timestamp: match.utcDate,
      });
    }

    const finishedRes = await fetch(
      `${FOOTBALL_DATA_BASE}/teams/351/matches?status=FINISHED&limit=1`,
      {
        headers: { "X-Auth-Token": apiKey },
      },
    );

    if (finishedRes.ok) {
      const finishedJson = await finishedRes.json();
      const lastMatch = finishedJson.matches?.[0];

      if (lastMatch) {
        const home = lastMatch.homeTeam?.shortName ?? "?";
        const away = lastMatch.awayTeam?.shortName ?? "?";
        const homeGoals = lastMatch.score?.fullTime?.home ?? "?";
        const awayGoals = lastMatch.score?.fullTime?.away ?? "?";

        events.unshift({
          id: `epl_result_${lastMatch.id}`,
          league: "epl",
          headline: `${home} ${homeGoals} - ${awayGoals} ${away}`,
          detail: "Full time",
        });
      }
    }
  } catch {
    clearTimeout(timeout);
  }

  return events;
}
