/**
 * POST /api/no-tricks
 *
 * Sets or clears the `tricks_disabled` cookie for public visitors.
 * Body: { disabled: boolean }
 *
 * Auth: none required — public visitors use this.
 * Owner: SD-7. Spec: docs/specs/surprise-and-delight.md §Kill switch.
 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "tricks_disabled";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { disabled?: boolean };
  try {
    body = (await req.json()) as { disabled?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.disabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  if (body.disabled) {
    res.cookies.set(COOKIE_NAME, "1", {
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    res.cookies.delete(COOKIE_NAME);
  }

  return res;
}
