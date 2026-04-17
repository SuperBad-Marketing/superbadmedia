/**
 * Newsletter unsubscribe endpoint — Spam Act 2003 compliance.
 *
 * GET /api/newsletter/unsubscribe?sid=<subscriber_id>
 *
 * Marks the subscriber as `unsubscribed`, sets `unsubscribed_at_ms`,
 * and returns a simple HTML confirmation page. Re-subscribe requires
 * a fresh opt-in (spec §4.3).
 *
 * Also handles POST for RFC 8058 `List-Unsubscribe-Post` one-click
 * unsubscribe (mail clients send a POST with `List-Unsubscribe=One-Click`).
 *
 * Owner: CE-7.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema/newsletter-subscribers";
import { logActivity } from "@/lib/activity-log";

async function handleUnsubscribe(subscriberId: string): Promise<boolean> {
  if (!subscriberId || typeof subscriberId !== "string") return false;

  const subscriber = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, subscriberId))
    .get();

  if (!subscriber) return false;

  // Already unsubscribed — idempotent, still show confirmation
  if (subscriber.status === "unsubscribed") return true;

  const nowMs = Date.now();

  await db
    .update(newsletterSubscribers)
    .set({
      status: "unsubscribed",
      unsubscribed_at_ms: nowMs,
    })
    .where(eq(newsletterSubscribers.id, subscriberId));

  await logActivity({
    companyId: subscriber.company_id,
    kind: "content_newsletter_sent",
    body: `Subscriber unsubscribed: ${subscriber.email}.`,
    meta: {
      subscriber_id: subscriberId,
      email: subscriber.email,
      consent_source: subscriber.consent_source,
    },
  });

  return true;
}

/**
 * GET handler — browser click from the unsubscribe link in the email body.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const sid = request.nextUrl.searchParams.get("sid");

  if (!sid) {
    return new NextResponse(renderPage("Missing subscriber ID.", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const success = await handleUnsubscribe(sid);

  if (!success) {
    return new NextResponse(
      renderPage("Subscriber not found. You may already be unsubscribed.", false),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  return new NextResponse(
    renderPage("You have been unsubscribed. You will no longer receive this newsletter.", true),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

/**
 * POST handler — RFC 8058 one-click unsubscribe from mail clients.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const sid = request.nextUrl.searchParams.get("sid");

  if (!sid) {
    return NextResponse.json({ error: "Missing subscriber ID" }, { status: 400 });
  }

  const success = await handleUnsubscribe(sid);

  if (!success) {
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// ── HTML renderer ───────────────────────────────────────────────────

function renderPage(message: string, success: boolean): string {
  const statusColor = success ? "#16a34a" : "#dc2626";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${success ? "Unsubscribed" : "Error"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #fafaf9;
      color: #292524;
    }
    .card {
      max-width: 420px;
      padding: 32px;
      text-align: center;
    }
    .status {
      font-size: 14px;
      color: ${statusColor};
      margin-bottom: 8px;
    }
    p { font-size: 16px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <p class="status">${success ? "Done" : "Error"}</p>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
