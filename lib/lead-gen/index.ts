/**
 * Lead Generation module barrel export.
 *
 * Owner: Lead Generation spec.
 * LG-1: data model + DNC enforcement + sender identity.
 */

export {
  isBlockedFromOutreach,
  addDncEmail,
  addDncDomain,
  removeDncEmail,
  removeDncDomain,
} from "./dnc";

export { SUPERBAD_SENDER, SUPERBAD_FROM_STRING } from "./sender";
