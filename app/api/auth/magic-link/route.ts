/**
 * SB-6a: subscriber magic-link redeem endpoint.
 *
 * Arriving from the login email, the user hits GET with `?token=<raw>`.
 * We pass the raw token through to Auth.js `signIn("credentials", ...)`
 * where the Node-side `authorize()` redeems it (marks consumed, promotes
 * prospect→client, logs activity) and issues a JWT session cookie.
 * On success Auth.js redirects to `/lite/onboarding`; on failure we
 * bounce back to `/get-started/welcome` with an error flag.
 */
import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/get-started/welcome?error=missing_token", req.url),
    );
  }

  try {
    await signIn("credentials", {
      subscriberLoginToken: token,
      redirectTo: "/lite/onboarding",
    });
    // Unreachable — signIn throws NEXT_REDIRECT on success.
    return NextResponse.redirect(new URL("/lite/onboarding", req.url));
  } catch (err) {
    // Auth.js throws a typed redirect error that Next.js handles natively
    // when it reaches the framework boundary. Let it bubble.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return NextResponse.redirect(
      new URL("/get-started/welcome?error=link_invalid", req.url),
    );
  }
}
