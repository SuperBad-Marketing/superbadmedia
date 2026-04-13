/**
 * reportIssue — the single approved path to raise a support ticket from any
 * client-facing surface in SuperBad Lite.
 *
 * What it does:
 *   1. Inserts a row into `support_tickets`.
 *   2. Captures a Sentry event when `sentry_enabled` kill-switch is on.
 *   3. Logs `support_ticket_created` to `activity_log`.
 *
 * Usage (client component):
 *   import { reportIssue } from "@/lib/support";
 *   await reportIssue({ surface: "quotes", pageUrl: window.location.href });
 *
 * Owner: B1. Consumer: ReportIssueButton, every client-facing surface.
 */
"use server";

import * as Sentry from "@sentry/nextjs";
import { db as defaultDb } from "@/lib/db";
import { support_tickets } from "@/lib/db/schema/support-tickets";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";

export interface ReportIssueContext {
  /** Which feature surface the issue came from (e.g. "quotes", "portal"). */
  surface: string;
  /** Full URL of the page where the issue occurred. */
  pageUrl: string;
  /** Optional freeform description from the user. */
  description?: string;
  /** Admin user id from NextAuth session, if available. */
  userId?: string;
}

export interface ReportIssueResult {
  ticketId: string;
  sentryEventId?: string;
}

/**
 * @param ctx - issue context from the calling surface
 * @param dbOverride - optional DB override for tests
 */
export async function reportIssue(
  ctx: ReportIssueContext,
  dbOverride?: typeof defaultDb,
): Promise<ReportIssueResult> {
  const db = dbOverride ?? defaultDb;

  const ticketId = crypto.randomUUID();
  const now = Date.now();

  // --- Capture to Sentry (gated) ---
  let sentryEventId: string | undefined;
  if (killSwitches.sentry_enabled) {
    sentryEventId = Sentry.captureMessage(
      `[support] Issue reported on ${ctx.surface}: ${ctx.description ?? "(no description)"}`,
      {
        level: "info",
        tags: { surface: ctx.surface },
        extra: { pageUrl: ctx.pageUrl, ticketId },
        user: ctx.userId ? { id: ctx.userId } : undefined,
      },
    );
  }

  // --- Persist support ticket ---
  await db.insert(support_tickets).values({
    id: ticketId,
    user_id: ctx.userId ?? null,
    surface: ctx.surface,
    page_url: ctx.pageUrl,
    description: ctx.description ?? null,
    session_replay_url: null,
    sentry_issue_id: sentryEventId ?? null,
    status: "open",
    created_at_ms: now,
    resolved_at_ms: null,
  });

  // --- Activity log ---
  await logActivity({
    kind: "support_ticket_created",
    body: `Issue reported on ${ctx.surface} — ticket ${ticketId}`,
    meta: { ticketId, surface: ctx.surface, pageUrl: ctx.pageUrl },
    createdBy: ctx.userId ?? null,
    createdAtMs: now,
  });

  return { ticketId, sentryEventId };
}
