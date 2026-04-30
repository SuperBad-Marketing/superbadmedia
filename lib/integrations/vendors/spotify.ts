import type { VendorManifest } from "@/lib/wizards/types";

export const spotifyManifest: VendorManifest = {
  vendorKey: "spotify",
  jobs: [
    {
      name: "spotify.playlists.read",
      defaultBand: { p95: 800, p99: 2000 },
      unit: "ms",
    },
  ],
  actorConvention: "internal",
  killSwitchKey: "setup_wizards_enabled",
  humanDescription:
    "Spotify — playlist picker for the cockpit music embed.",
};

export const SPOTIFY_OAUTH_SCOPES = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
];

export const SPOTIFY_OAUTH_AUTHORIZE_URL =
  "https://accounts.spotify.com/authorize";

export const SPOTIFY_TOKEN_URL =
  "https://accounts.spotify.com/api/token";
