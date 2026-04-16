import { NextResponse, type NextRequest } from "next/server";
import { killSwitches } from "@/lib/kill-switches";
import { GraphWebhookNotificationSchema } from "@/lib/graph/types";
import { createGraphClient, getActiveGraphState, runDeltaSync } from "@/lib/graph";

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

  if (!killSwitches.inbox_sync_enabled) {
    return NextResponse.json({ status: "disabled" }, { status: 200 });
  }

  try {
    const body = await req.json();
    const parsed = GraphWebhookNotificationSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[graph-webhook] Invalid notification payload:", parsed.error);
      return NextResponse.json({ status: "invalid" }, { status: 400 });
    }

    const state = await getActiveGraphState();
    if (!state) {
      console.error("[graph-webhook] No active graph_api_state row");
      return NextResponse.json({ status: "no_state" }, { status: 200 });
    }

    const client = await createGraphClient(state.integration_connection_id);
    await runDeltaSync(client, state.id);

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[graph-webhook] Error processing notification:", err);
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
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
