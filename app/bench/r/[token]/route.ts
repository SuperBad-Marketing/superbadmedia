import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { redeemBenchMagicLink } from "@/lib/bench/redeem-magic-link";
import { encodeBenchSession, BENCH_SESSION_COOKIE } from "@/lib/bench/guard";
import settings from "@/lib/settings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token || typeof token !== "string") {
    return NextResponse.redirect(
      new URL("/bench/expired", request.url),
    );
  }

  const session = await redeemBenchMagicLink(token);

  if (!session) {
    return NextResponse.redirect(
      new URL("/bench/expired", request.url),
    );
  }

  const candidate = db
    .select({ stage: candidates.stage })
    .from(candidates)
    .where(eq(candidates.id, session.candidateId))
    .get();

  if (!candidate || candidate.stage === "archived") {
    return NextResponse.redirect(
      new URL("/bench/expired", request.url),
    );
  }

  const ttlDays = await settings.get("portal.session_cookie_ttl_days");
  const maxAgeSeconds = ttlDays * 24 * 60 * 60;
  const cookieValue = encodeBenchSession(session);

  const response = NextResponse.redirect(
    new URL("/bench", request.url),
  );

  response.cookies.set(BENCH_SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return response;
}
