/**
 * Critical-flight wizard completion check.
 *
 * Returns true if the current admin user has completed the critical-flight
 * onboarding wizard. A8 ships a stub that always returns `true` — the wizard
 * progress table lands in SW-1 (Wave 6) and SW-4 wires the real DB check.
 *
 * The seam is exposed here so middleware.ts can reference it now; SW-4 only
 * needs to update this function's implementation, not the call site.
 *
 * Owner: A8 (stub). Real implementation owner: SW-4.
 */
export async function hasCompletedCriticalFlight(
  // SW-4 will use this to look up wizard progress for the given user.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId: string,
): Promise<boolean> {
  // Stub: always complete until SW-4 lands the wizard-progress table.
  return true;
}
