import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import { getTierHealth } from "@/lib/observatory/queries/tier-health";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await getTierHealth();
  return NextResponse.json({ tiers });
}
