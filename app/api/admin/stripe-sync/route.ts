export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import { syncStripePayments } from "@/lib/finance/stripe-payment-sync";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncStripePayments(30);
  return NextResponse.json(result);
}
