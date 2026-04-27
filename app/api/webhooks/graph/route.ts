import { NextResponse, type NextRequest } from "next/server";

/**
 * Graph API webhook receiver. Two modes:
 *
 * 1. Validation: Microsoft sends GET with ?validationToken=<token>.
 *    We echo the token back as text/plain to prove we own the endpoint.
 *
 * 2. Notification: Microsoft sends POST with change notifications.
 *    We trigger a delta sync to pull new messages.
 *
 * Per spec §16 discipline 59: idempotent on graph_message_id — replayed
 * notifications don't create duplicate messages.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Acknowledge immediately — the scheduled inbox_graph_sync task (every
  // 5 min) handles the actual delta sync. Running it inline on every
  // webhook notification was hammering the Graph API into 429s / timeouts,
  // which starved the server for all other work.
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
