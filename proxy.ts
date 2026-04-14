/**
 * SuperBad Lite — Next.js middleware.
 *
 * Two sequential gates (per FOUNDATIONS §11.8 + BUILD_PLAN A8):
 *
 * Gate 1 — Brand DNA Gate (runs first):
 *   Every admin route checks `session.user.brand_dna_complete`. If false,
 *   redirect to `/lite/onboarding`. Bypass with `BRAND_DNA_GATE_BYPASS=true`.
 *   Self-terminates when BDA-3 completes the SuperBad-self profile and forces
 *   a session refresh that sets `brand_dna_complete = true`.
 *
 * Gate 2 — Critical Flight (runs second):
 *   Stub — `hasCompletedCriticalFlight()` always returns true in A8.
 *   SW-4 will replace with a real wizard-progress check.
 *
 * Public routes (no auth required):
 *   - /api/auth/*          — NextAuth endpoints
 *   - /lite/portal/*       — prospect/client portal (own cookie auth)
 *   - /lite/onboarding     — Brand DNA gate target (must not loop)
 *   - /lite/login          — admin sign-in page (lands in Wave 2)
 *   - /lite/design         — design gallery (dev tool, always public)
 *   - /api/*               — API routes handle their own auth
 *   - /_next/*             — Next.js internals
 *   - /favicon.ico         — static
 *
 * Edge-runtime note:
 *   This file imports `NextAuth(authConfig)` using `auth.config.ts` which
 *   has no native-module dependencies. The full `auth.ts` (with `db`) is
 *   NOT imported here. Per AUTONOMY_PROTOCOL §G4: this design is intentional.
 *
 * Owner: A8.
 */
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/auth.config";

const { auth } = NextAuth(authConfig);

/** Routes that bypass both gates entirely. */
function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/lite/portal/") ||
    pathname === "/lite/portal" ||
    pathname.startsWith("/lite/onboarding") ||
    pathname.startsWith("/lite/login") ||
    pathname.startsWith("/lite/design") ||
    // Legal pages are publicly accessible (no auth gate) — B3
    pathname.startsWith("/lite/legal/") ||
    pathname === "/lite/legal" ||
    // Client-facing quote pages are anonymous — QB-4a
    pathname.startsWith("/lite/quotes/") ||
    // Client-facing invoice pages are anonymous (token-gated) — BI-1b
    pathname.startsWith("/lite/invoices/") ||
    // Brand DNA assessment — bypasses brand-dna gate (user IS taking the assessment).
    // Auth is resolved inside Server Components and Actions via auth() — BDA-2.
    pathname.startsWith("/lite/brand-dna") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Only gate admin-surface routes under /lite/
  if (!pathname.startsWith("/lite")) {
    return NextResponse.next();
  }

  // ── Auth check ────────────────────────────────────────────────────────────
  if (!req.auth) {
    const loginUrl = new URL("/lite/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Gate 1: Brand DNA Gate ─────────────────────────────────────────────────
  const bypassGate = process.env.BRAND_DNA_GATE_BYPASS === "true";
  if (!bypassGate && !req.auth.user?.brand_dna_complete) {
    return NextResponse.redirect(new URL("/lite/onboarding", req.url));
  }

  // ── Gate 2: Critical Flight ───────────────────────────────────────────────
  // The jwt callback (`lib/auth/auth.ts`) calls hasCompletedCriticalFlight()
  // at sign-in / session.update() and caches the result on the JWT; gate 2
  // reads it from req.auth.user.critical_flight_complete. Edge-safe.
  //
  // The target route `/lite/first-run` is allowlisted out of gate 2 (below)
  // to prevent a redirect loop. It redirects to the next incomplete wizard.
  if (
    !pathname.startsWith("/lite/first-run") &&
    !req.auth.user?.critical_flight_complete
  ) {
    return NextResponse.redirect(new URL("/lite/first-run", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (Next.js static files)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
