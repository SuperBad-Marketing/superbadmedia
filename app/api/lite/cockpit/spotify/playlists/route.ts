import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import { getCredential } from "@/lib/integrations/getCredential";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credsRaw = await getCredential("spotify");
  if (!credsRaw) {
    return NextResponse.json({ connected: false, playlists: [] });
  }

  let accessToken: string;
  try {
    const parsed = JSON.parse(credsRaw) as { accessToken: string };
    accessToken = parsed.accessToken;
  } catch {
    accessToken = credsRaw;
  }

  try {
    const res = await fetch(
      "https://api.spotify.com/v1/me/playlists?limit=50",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      return NextResponse.json({ connected: true, playlists: [], error: "Token may have expired" });
    }

    const data = await res.json();
    const playlists = (data.items ?? []).map(
      (p: { id: string; name: string; images?: { url: string }[]; tracks?: { total: number } }) => ({
        id: p.id,
        name: p.name,
        imageUrl: p.images?.[0]?.url ?? null,
        trackCount: p.tracks?.total ?? 0,
      }),
    );

    return NextResponse.json({ connected: true, playlists });
  } catch {
    return NextResponse.json({ connected: true, playlists: [], error: "Failed to fetch playlists" });
  }
}
