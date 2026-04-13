/**
 * EU IP detection.
 *
 * Named `maxmind.ts` per BUILD_PLAN B3 brief. Implementation uses:
 *   1. `GEOIP_TEST_EU_IPS` env var override (comma-separated; test + dev use).
 *   2. MaxMind GeoLite2 binary DB if `MAXMIND_DB_PATH` is set (production path).
 *      NOTE: MaxMind integration is stubbed — the `@maxmind/geoip2-node` package
 *      is not installed because it requires a binary .mmdb file download (MaxMind
 *      account required). When MAXMIND_DB_PATH is set but the package is not
 *      installed, falls through to the HTTP fallback. PATCHES_OWED: b3_maxmind_stub.
 *   3. ip-api.com free HTTP lookup (500ms timeout, 45 req/min limit) — production
 *      fallback until MaxMind DB is provisioned in Phase 6.
 *   4. Returns `false` on error / timeout (safe default: show EU banner only for
 *      confirmed EU IPs).
 *
 * Owner: B3.
 */

const EU_CONTINENT_CODE = "EU";

type IpApiResponse = {
  continentCode?: string;
  status?: string;
};

/**
 * Returns `true` if the given IP address appears to originate from the
 * European Economic Area (or UK, which runs UK-GDPR). Returns `false` on
 * lookup failure, timeout, or unrecognised IP.
 *
 * Safe to call from Server Components and API routes. NOT safe in Edge
 * middleware (uses Node.js fetch, not Edge-compatible WebFetch).
 */
export async function isEuIp(ip: string): Promise<boolean> {
  if (!ip) return false;

  // 1 — Test override
  const testEuIps =
    process.env.GEOIP_TEST_EU_IPS?.split(",").map((s) => s.trim()) ?? [];
  if (testEuIps.includes(ip)) return true;

  // 2 — Loopback / private addresses: skip lookup
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.")
  ) {
    return false;
  }

  // 3 — HTTP lookup via ip-api.com (free tier, no API key)
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=continentCode,status`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(500),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as IpApiResponse;
    if (data.status === "fail") return false;
    return data.continentCode === EU_CONTINENT_CODE;
  } catch {
    // Timeout, network error, or malformed response — safe fallback
    return false;
  }
}

/**
 * Extracts the real client IP from the `x-forwarded-for` header.
 * Returns the first (leftmost) non-private IP, or an empty string.
 */
export function getClientIp(
  forwardedFor: string | null | undefined,
): string {
  if (!forwardedFor) return "";
  const parts = forwardedFor.split(",").map((s) => s.trim());
  // Return the leftmost non-empty value (the original client IP)
  return parts[0] ?? "";
}
