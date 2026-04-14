/**
 * Observatory band-registration stub — SW-3.
 *
 * The real Cost & Usage Observatory ships in its own wave. Until then,
 * `registerBands()` is additive and side-effect-free: it returns the band
 * names pulled from the vendor manifest so the celebration step's
 * post-completion summary can render them.
 *
 * When Observatory lands, it replaces this module's internals without
 * changing the signature — callers (registerIntegration) keep working.
 *
 * Owner: SW-3. Consumer: registerIntegration.
 */
import type { VendorJobBand } from "@/lib/wizards/types";

export type BandName = string;

export async function registerBands(
  jobs: VendorJobBand[],
): Promise<BandName[]> {
  return jobs.map((j) => j.name);
}
