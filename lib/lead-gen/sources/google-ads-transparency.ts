/**
 * Google Ads Transparency Center discovery source via SerpAPI.
 *
 * DISABLED: SerpAPI does not support the `google_ads_transparencycenter`
 * engine. This source returns an empty candidate list until a supported
 * alternative is available.
 *
 * Owner: LG-2. Consumer: discovery orchestrator.
 */

import type { DiscoveredCandidate, DiscoverySearchParams } from "../types";

export async function searchGoogleAdsTransparency(
  _params: DiscoverySearchParams,
): Promise<{ candidates: DiscoveredCandidate[]; error?: string }> {
  return { candidates: [] };
}
