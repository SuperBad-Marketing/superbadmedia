/**
 * SuperBad Lite — Next.js middleware.
 *
 * Layering order (applied in sequence to every admin route):
 *   1. Auth check (NextAuth) — unauthenticated → redirect to /lite/login
 *   2. Brand DNA gate — SuperBad-self profile not complete → redirect to
 *      /lite/onboarding (bypassed by BRAND_DNA_GATE_BYPASS=true)
 *   3. Critical-flight gate — stub returning true until SW-4 (always passes)
 *
 * Admin routes: anything under /lite/ EXCEPT:
 *   - /lite/portal/*        — client portal (own magic-link auth)
 *   - /lite/onboarding      — the gate's redirect target
 *   - /lite/login           — auth page
 *   - /api/auth/*           — NextAuth endpoints
 *
 * Both Brand DNA and critical-flight gates are self-terminating per user —
 * once their DB-side condition is met (BDA-3 / SW-4) and the JWT is refreshed,
 * the redirect stops without any middleware change.
 *
 * BRAND_DNA_GATE_BYPASS=true — env-var escape hatch for Andy if the gate
 * ever locks him out (documented in INCIDENT_PLAYBOOK.md, owed Phase 6).
 *
 * Owner: A8. Gate stubs wired by: BDA-3 (brand DNA), SW-4 (critical flight).
 */
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";
import { auth } from "@/lib/auth/auth";
import { applyBrandDnaGate, isAdminPath } from "@/lib/auth/auth";
import { hasCompletedCriticalFlight } from "@/lib/auth/has-completed-critical-flight";

export default auth(async (req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Pass through NextAuth API routes unconditionally
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Only gate admin paths
  if (!isAdminPath(pathname)) {
    return NextResponse.next();
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  const session = req.auth;
  if (!session?.user) {
    const loginUrl = new URL("/lite/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Brand DNA gate ────────────────────────────────────────────────────────
  const bypass = process.env.BRAND_DNA_GATE_BYPASS === "true";
  const brandDnaComplete = (
    session.user as { brandDnaComplete?: boolean }
  ).brandDnaComplete;
  const decision = applyBrandDnaGate(brandDnaComplete, bypass, pathname);
  if (decision === "redirect_to_onboarding") {
    return NextResponse.redirect(new URL("/lite/onboarding", req.url));
  }

  // ── Critical-flight gate ──────────────────────────────────────────────────
  // Stub returns true (SW-4 wires the real check). If ever false it shares
  // the same onboarding redirect target as the Brand DNA gate.
  const userId = (session.user as { id?: string }).id;
  const criticalFlightDone = await hasCompletedCriticalFlight(userId);
  if (!criticalFlightDone && !pathname.startsWith("/lite/onboarding")) {
    return NextResponse.redirect(new URL("/lite/onboarding", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next/static  — Next.js static assets
     *   - _next/image   — Next.js image optimiser
     *   - favicon.ico   — favicon
     *   - public/       — public directory
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
