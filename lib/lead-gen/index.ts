/**
 * Lead Generation module barrel export.
 *
 * Owner: Lead Generation spec.
 * LG-1: data model + DNC enforcement + sender identity.
 * LG-2: types + discovery source adapters.
 */

export {
  isBlockedFromOutreach,
  addDncEmail,
  addDncDomain,
  removeDncEmail,
  removeDncDomain,
} from "./dnc";

export { SUPERBAD_SENDER, SUPERBAD_FROM_STRING } from "./sender";

export type {
  ViabilityProfile,
  DiscoveryCandidate,
  DiscoverySearchInput,
  DiscoveryResult,
} from "./types";

export {
  searchMetaAdLibrary,
  searchGoogleMaps,
  searchGoogleAdsTransparency,
} from "./sources";
