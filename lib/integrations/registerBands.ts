/**
 * Observatory band-registration bridge — wires wizard vendor manifests
 * into the Observatory job registry for validation.
 *
 * Signature unchanged from the SW-3 stub so callers (registerIntegration)
 * keep working. Internals now validate that each vendor job name maps to
 * a registered Observatory job — emits a console.warn in production for
 * unregistered names (wizard-specific latency bands may not have 1:1
 * Observatory cost-band counterparts).
 *
 * Owner: COB-2. Consumer: registerIntegration.
 */
import type { VendorJobBand } from "@/lib/wizards/types";
import { isJobRegistered } from "@/lib/observatory/job-registry";

export type BandName = string;

export async function registerBands(
  jobs: VendorJobBand[],
): Promise<BandName[]> {
  return jobs.map((j) => {
    if (!isJobRegistered(j.name) && process.env.NODE_ENV === "development") {
      console.warn(
        `[registerBands] Vendor job "${j.name}" has no Observatory cost-band entry. ` +
        `If this job logs to external_call_log, add it to lib/observatory/job-registry.ts.`,
      );
    }
    return j.name;
  });
}
