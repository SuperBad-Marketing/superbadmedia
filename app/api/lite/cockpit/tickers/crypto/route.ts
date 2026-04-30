import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";

const CACHE_TTL_MS = 300000;

let cache: { data: unknown; fetchedAt: number } | null = null;

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true",
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(fallbackData());
    }

    const json = await res.json();

    const data = {
      btc: {
        price: json.bitcoin?.usd ?? 0,
        change24h: json.bitcoin?.usd_24h_change ?? 0,
      },
      eth: {
        price: json.ethereum?.usd ?? 0,
        change24h: json.ethereum?.usd_24h_change ?? 0,
      },
    };

    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(fallbackData());
  }
}

function fallbackData() {
  return {
    btc: { price: 0, change24h: 0 },
    eth: { price: 0, change24h: 0 },
  };
}
