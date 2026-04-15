/**
 * POST /api/stripe/billing-portal
 *
 * Creates a short-TTL Stripe Customer Portal session for the authed
 * subscriber's latest deal and 302s to the Stripe-hosted URL. Used by
 * the `past_due` + `waiting` variants on `/lite/onboarding`.
 *
 * Auth: role="client" only. Anything else bounces to /get-started/welcome.
 * Origin guard: same-origin check on the Origin header.
 *
 * Owner: SB-6b.
 * Spec: docs/specs/saas-subscription-billing.md §5.1.
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import { loadSubscriberSummary } from "@/lib/saas-products/subscriber-summary";
import { getStripe } from "@/lib/stripe/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://superbadmedia.com.au"
  );
}

export async function POST(req: Request) {
  // Same-origin guard — billing-portal links aren't meant to be triggered
  // cross-origin.
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const expected = new URL(baseUrl()).origin;
      if (new URL(origin).origin !== expected) {
        return NextResponse.json({ error: "bad_origin" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "bad_origin" }, { status: 403 });
    }
  }

  const session = await auth();
  if (session?.user?.role !== "client" || !session.user.email) {
    return NextResponse.redirect(new URL("/get-started/welcome", baseUrl()));
  }

  const summary = await loadSubscriberSummary(session.user.email);
  if (!summary?.stripeCustomerId) {
    return NextResponse.redirect(new URL("/lite/onboarding", baseUrl()));
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: summary.stripeCustomerId,
      return_url: new URL("/lite/onboarding", baseUrl()).toString(),
    });
    return NextResponse.redirect(portal.url, { status: 303 });
  } catch {
    return NextResponse.redirect(
      new URL("/lite/onboarding?error=portal_unavailable", baseUrl()),
    );
  }
}
