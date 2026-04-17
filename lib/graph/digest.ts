/**
 * Daily morning digest — queries silent notifications from the last N hours,
 * builds a grouped email body, and sends via Resend.
 *
 * Spec: unified-inbox.md §10.3.
 * Owner: UI-13. Consumer: inbox-digest handler.
 */
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema/notifications";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { sendEmail } from "@/lib/channels/email/send";
import { getImportProgress, getGraphStateForImport } from "./history-import";
import settingsRegistry from "@/lib/settings";

// ── Types ───────────────────────────────────────────────────────────

export interface DigestGroup {
  /** The priority_class or noise_subclass category name */
  category: string;
  /** Total count of silenced messages in this group */
  count: number;
  /** One-line previews for non-noise silenced threads (subject + sender) */
  previews: Array<{ subject: string; from: string }>;
}

export interface DigestContent {
  subject: string;
  bodyHtml: string;
  groups: DigestGroup[];
  totalSilenced: number;
  importNote: string | null;
}

// ── Core logic ──────────────────────────────────────────────────────

/**
 * Build the digest content by querying silent notifications in the window.
 * Returns null if there are zero silenced messages and `no_send_on_zero`
 * is true (default).
 */
export async function buildDigestContent(
  nowMs: number,
): Promise<DigestContent | null> {
  const windowHours = await settingsRegistry.get("inbox.digest_silent_window_hours");
  const noSendOnZero = await settingsRegistry.get("inbox.digest_no_send_on_zero");

  const windowStartMs = nowMs - windowHours * 60 * 60 * 1000;

  // Query silent notifications in the window, joined to messages + threads
  // for previews. `fired_transport = "none"` = silent by design (spec §10.2).
  const rows = await db
    .select({
      notificationId: notifications.id,
      messageId: notifications.message_id,
      priority: notifications.priority,
      reason: notifications.reason,
      firedAtMs: notifications.fired_at_ms,
      msgSubject: messages.subject,
      msgFrom: messages.from_address,
      msgPriorityClass: messages.priority_class,
      msgNoiseSubclass: messages.noise_subclass,
      threadSubject: threads.subject,
    })
    .from(notifications)
    .leftJoin(messages, eq(notifications.message_id, messages.id))
    .leftJoin(threads, eq(messages.thread_id, threads.id))
    .where(
      and(
        eq(notifications.fired_transport, "none"),
        gte(notifications.fired_at_ms, windowStartMs),
      ),
    );

  if (rows.length === 0 && noSendOnZero) {
    return null;
  }

  // Group by category: noise uses noise_subclass, others use priority_class
  const groupMap = new Map<string, DigestGroup>();

  for (const row of rows) {
    const isNoise = row.msgPriorityClass === "noise";
    const category = isNoise
      ? (row.msgNoiseSubclass ?? "noise")
      : (row.msgPriorityClass ?? "unknown");

    let group = groupMap.get(category);
    if (!group) {
      group = { category, count: 0, previews: [] };
      groupMap.set(category, group);
    }
    group.count++;

    // Non-noise silenced threads get one-line previews
    if (!isNoise && row.msgSubject) {
      group.previews.push({
        subject: row.threadSubject ?? row.msgSubject ?? "(no subject)",
        from: row.msgFrom ?? "unknown",
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  // Check for recent import completion
  const importNote = await getImportCompletionNote(windowStartMs, nowMs);

  const totalSilenced = rows.length;
  const subject = buildSubject(totalSilenced, groups);
  const bodyHtml = buildBodyHtml(totalSilenced, groups, importNote);

  return { subject, bodyHtml, groups, totalSilenced, importNote };
}

/**
 * Send the digest email via Resend (transactional classification).
 */
export async function sendDigestEmail(
  content: DigestContent,
): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return { sent: false, skipped: true, reason: "ADMIN_EMAIL not set" };
  }

  return sendEmail({
    to: adminEmail,
    subject: content.subject,
    body: content.bodyHtml,
    classification: "transactional",
    purpose: "inbox_morning_digest",
    tags: [{ name: "type", value: "digest" }],
  });
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildSubject(total: number, groups: DigestGroup[]): string {
  if (total === 0) {
    return "Inbox digest — nothing silenced overnight. Suspicious.";
  }
  if (total === 1) {
    return "Inbox digest — 1 thing you didn't need to see.";
  }
  const noiseCount = groups
    .filter((g) => !["signal", "urgent", "push", "unknown"].includes(g.category))
    .reduce((sum, g) => sum + g.count, 0);
  if (noiseCount === total) {
    return `Inbox digest — ${total} things you didn't need to see.`;
  }
  return `Inbox digest — ${total} silenced, ${total - noiseCount} might be worth a look.`;
}

function buildBodyHtml(
  total: number,
  groups: DigestGroup[],
  importNote: string | null,
): string {
  const lines: string[] = [];

  lines.push(
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2a2420;">`,
  );
  lines.push(
    `<p style="font-size: 14px; color: #8c8279; margin: 0 0 24px;">SuperBad Lite — morning digest</p>`,
  );

  if (total === 0) {
    lines.push(
      `<p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">Nothing silenced in the last 24 hours. Either the inbox is quiet, or the classifier is asleep. Either way, you're clear.</p>`,
    );
  } else {
    lines.push(
      `<p style="font-size: 16px; line-height: 1.5; margin: 0 0 16px;">${total} message${total === 1 ? "" : "s"} handled without you. Here's the summary.</p>`,
    );

    // Noise groups (counts only)
    const noiseGroups = groups.filter((g) =>
      ["transactional", "marketing", "automated", "update", "noise"].includes(g.category),
    );
    if (noiseGroups.length > 0) {
      lines.push(
        `<p style="font-size: 13px; font-weight: 600; color: #8c8279; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 8px;">Noise</p>`,
      );
      for (const g of noiseGroups) {
        const label = g.category === "noise" ? "general noise" : g.category;
        lines.push(
          `<p style="font-size: 15px; margin: 0 0 4px; color: #4a4440;">${g.count} ${label}</p>`,
        );
      }
    }

    // Non-noise groups (one-line previews)
    const signalGroups = groups.filter(
      (g) =>
        !["transactional", "marketing", "automated", "update", "noise"].includes(g.category),
    );
    if (signalGroups.length > 0) {
      lines.push(
        `<p style="font-size: 13px; font-weight: 600; color: #8c8279; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 8px;">Worth a look</p>`,
      );
      for (const g of signalGroups) {
        for (const preview of g.previews.slice(0, 5)) {
          const escapedSubject = escapeHtml(truncate(preview.subject, 60));
          const escapedFrom = escapeHtml(truncate(preview.from, 30));
          lines.push(
            `<p style="font-size: 15px; margin: 0 0 4px; color: #2a2420;"><strong>${escapedFrom}</strong> — ${escapedSubject}</p>`,
          );
        }
        if (g.previews.length > 5) {
          lines.push(
            `<p style="font-size: 13px; color: #8c8279; margin: 0 0 4px;">+ ${g.previews.length - 5} more</p>`,
          );
        }
      }
    }
  }

  if (importNote) {
    lines.push(
      `<p style="font-size: 13px; color: #8c8279; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e8e4e0;">${escapeHtml(importNote)}</p>`,
    );
  }

  lines.push(
    `<p style="font-size: 12px; color: #b0a89e; margin: 32px 0 0;">Sent by Lite because you weren't looking. If this keeps arriving and you don't want it, something has gone wrong on my end.</p>`,
  );
  lines.push(`</div>`);

  return lines.join("\n");
}

async function getImportCompletionNote(
  windowStartMs: number,
  nowMs: number,
): Promise<string | null> {
  try {
    const graphState = await getGraphStateForImport();
    if (!graphState) return null;

    const progress = await getImportProgress(graphState.id);
    if (!progress || progress.status !== "complete") return null;

    // Check if the import completed within the digest window.
    // `updatedAtMs` reflects when the status flipped to "complete".
    const completedAtMs = progress.updatedAtMs ?? 0;
    if (completedAtMs >= windowStartMs && completedAtMs <= nowMs) {
      const total = progress.imported ?? 0;
      return `History import finished — ${total.toLocaleString()} messages sorted.`;
    }
  } catch {
    // Import progress is supplementary; don't block digest on failure
  }
  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "\u2026" : str;
}
