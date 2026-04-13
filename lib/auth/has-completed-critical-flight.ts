/**
 * Portal + admin gate helpers (pure) + critical-flight completion check.
 *
 * This file is intentionally free of NextAuth / Next.js imports so its pure
 * functions can be unit-tested in the Vitest node environment without the
 * ESM module resolution issues that come with importing `next-auth`.
 *
 * Exports:
 *   - `applyBrandDnaGate` — pure decision function for the Brand DNA gate
 *   - `isAdminPath`       — pure path classifier
 *   - `hasCompletedCriticalFlight` — stub (SW-4 wires the real query)
 *
 * Owner: A8. Gate stubs wired by: BDA-3 (brand DNA), SW-4 (critical flight).
 *
 * @module
 */

// ── Brand DNA gate ────────────────────────────────────────────────────────────

export type GateDecision = "allow" | "redirect_to_onboarding";

/**
 * Pure function: given the JWT's `brandDnaComplete` claim and the env bypass
 * flag, decide whether an admin request should proceed or redirect.
 *
 * Self-terminating: once `brandDnaComplete` is true, always "allow".
 * Bypass: `BRAND_DNA_GATE_BYPASS=true` always returns "allow".
 *
 * @param brandDnaComplete - The `brandDnaComplete` claim from the JWT token.
 * @param bypass           - True when BRAND_DNA_GATE_BYPASS env is set.
 * @param pathname         - The request pathname (used to avoid redirect loop).
 */
export function applyBrandDnaGate(
  brandDnaComplete: boolean | undefined,
  bypass: boolean,
  pathname: string,
): GateDecision {
  // Bypass always wins
  if (bypass) return "allow";

  // Already completed — gate is satisfied forever
  if (brandDnaComplete === true) return "allow";

  // Don't redirect to onboarding if already there (no loop)
  if (pathname.startsWith("/lite/onboarding")) return "allow";

  return "redirect_to_onboarding";
}

/**
 * True if pathname is an admin route that the Brand DNA gate applies to.
 *
 * Excluded from gating:
 *   - `/lite/portal/*`    — client portal, has own auth
 *   - `/lite/onboarding`  — the gate's redirect target
 *   - `/lite/login`       — auth page
 *   - `/api/auth/*`       — NextAuth API routes
 */
export function isAdminPath(pathname: string): boolean {
  if (!pathname.startsWith("/lite/")) return false;
  if (pathname.startsWith("/lite/portal/")) return false;
  if (pathname.startsWith("/lite/onboarding")) return false;
  return true;
}

// ── Critical-flight gate ──────────────────────────────────────────────────────

/**
 * Returns `true` when Andy has completed all critical-flight wizards.
 *
 * STUB — always true until SW-4 lands the real query against
 * `wizard_progress` (table created in SW-1).
 *
 * @param _userId - Admin user ID (unused until SW-4)
 */
export async function hasCompletedCriticalFlight(
  _userId?: string,
): Promise<boolean> {
  // SW-4 replaces this with:
  //   const row = await db.select().from(wizard_progress)
  //     .where(and(
  //       eq(wizard_progress.user_id, userId),
  //       eq(wizard_progress.kind, 'critical_flight'),
  //       eq(wizard_progress.completed, true)
  //     ))
  //     .limit(1)
  //   return row.length > 0
  return true;
}
