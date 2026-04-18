/**
 * GET /api/unsubscribe?token=<signed>
 * POST /api/unsubscribe (RFC 8058 one-click: List-Unsubscribe=One-Click)
 *
 * Validates HMAC-signed token → adds email to DNC → stops active
 * sequences → fires fast_unsubscribe circuit breaker if within 60s
 * of last send → renders confirmation page.
 *
 * No expiry on tokens — unsubscribe links remain valid indefinitely.
 *
 * Owner: LG-10. Spec: lead-generation.md §12.3.
 */

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema/contacts";
import { outreachSequences } from "@/lib/db/schema/outreach-sequences";
import { outreachSends } from "@/lib/db/schema/outreach-sends";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { logActivity } from "@/lib/activity-log";
import { addDncEmail } from "@/lib/lead-gen/dnc";
import { transitionAutonomyState } from "@/lib/lead-gen/autonomy";
import { verifyUnsubscribeToken } from "@/lib/lead-gen/unsubscribe-token";

export const runtime = "nodejs";

const FAST_UNSUB_WINDOW_MS = 60 * 1000;

async function handleUnsubscribe(token: string | null): Promise<NextResponse> {
  if (!token) {
    return new NextResponse(renderPage("Missing token.", false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const result = verifyUnsubscribeToken(token);
  if (!result.valid) {
    return new NextResponse(
      renderPage("Invalid or expired link.", false),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const { email, candidate_id } = result.payload;
  const nowMs = Date.now();

  // Add to DNC (idempotent)
  await addDncEmail(email, "unsubscribe_link", {
    reason: "unsubscribe_link_click",
  });

  // Update contact email_status if contact exists
  const normEmail = email.toLowerCase().trim();
  const [contact] = await db
    .select({ id: contacts.id, company_id: contacts.company_id })
    .from(contacts)
    .where(eq(contacts.email_normalised, normEmail))
    .limit(1);

  if (contact) {
    await db
      .update(contacts)
      .set({ email_status: "unsubscribed", updated_at_ms: nowMs })
      .where(eq(contacts.id, contact.id));
  }

  // Stop active sequences and check for fast unsubscribe
  if (candidate_id) {
    const sequences = await db
      .select()
      .from(outreachSequences)
      .where(
        and(
          eq(outreachSequences.status, "active"),
        ),
      );

    // Filter to sequences belonging to this candidate
    for (const seq of sequences) {
      const [send] = await db
        .select({ draft_id: outreachSends.draft_id })
        .from(outreachSends)
        .where(eq(outreachSends.sequence_id, seq.id))
        .limit(1);

      if (!send) continue;

      // Verify this sequence belongs to the candidate
      const [candidate] = await db
        .select({ id: leadCandidates.id })
        .from(leadCandidates)
        .where(eq(leadCandidates.id, candidate_id))
        .limit(1);

      if (!candidate) continue;

      await db
        .update(outreachSequences)
        .set({
          status: "stopped_unsubscribe",
          stopped_reason: "unsubscribe_link_click",
        })
        .where(eq(outreachSequences.id, seq.id));

      // Mark the last send as unsubscribed
      const sends = await db
        .select()
        .from(outreachSends)
        .where(eq(outreachSends.sequence_id, seq.id));

      const lastSend = sends.reduce<typeof sends[number] | null>((latest, s) => {
        const sentMs = s.sent_at instanceof Date ? s.sent_at.getTime() : (s.sent_at as number);
        const latestMs = latest
          ? (latest.sent_at instanceof Date ? latest.sent_at.getTime() : (latest.sent_at as number))
          : 0;
        return sentMs > latestMs ? s : latest;
      }, null);

      if (lastSend) {
        await db
          .update(outreachSends)
          .set({ unsubscribed_at: new Date(nowMs) })
          .where(eq(outreachSends.id, lastSend.id));

        // Fast unsubscribe circuit breaker: within 60s of last send
        const lastSentMs = lastSend.sent_at instanceof Date
          ? lastSend.sent_at.getTime()
          : (lastSend.sent_at as number);
        if (nowMs - lastSentMs < FAST_UNSUB_WINDOW_MS) {
          await transitionAutonomyState(seq.track as "saas" | "retainer", {
            type: "fast_unsubscribe",
            sendId: lastSend.id,
          });
        }
      }

      await logActivity({
        kind: "outreach_unsubscribed",
        dealId: seq.deal_id,
        body: `${email} unsubscribed via link`,
        createdBy: "system:unsubscribe_handler",
        meta: { email, candidate_id, sequence_id: seq.id },
      });
    }
  }

  return new NextResponse(renderPage("You've been unsubscribed.", true), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return handleUnsubscribe(token);
}

export async function POST(req: Request): Promise<NextResponse> {
  // RFC 8058 one-click unsubscribe sends form data
  try {
    const formData = await req.formData();
    const token =
      formData.get("token")?.toString() ??
      new URL(req.url).searchParams.get("token");
    return handleUnsubscribe(token);
  } catch {
    const url = new URL(req.url);
    return handleUnsubscribe(url.searchParams.get("token"));
  }
}

function renderPage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribe — SuperBad</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #faf9f7; color: #292524; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { max-width: 420px; padding: 48px 32px; text-align: center; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 12px; }
    p { font-size: 14px; color: #78716c; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${success ? "Done." : "Something went wrong."}</h1>
    <p>${escapeHtml(message)}${success ? " You won't hear from us again." : ""}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
