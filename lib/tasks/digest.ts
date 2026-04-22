/**
 * Task morning digest — queries overdue, due-today, and approval-outcome
 * tasks, builds a grouped email, and sends via Resend.
 *
 * Spec: task-manager.md §Notifications.
 * Owner: TM-7. Consumer: TM-8 (cron handler).
 */
import { and, eq, gte, lte, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, type TaskRow } from "@/lib/db/schema/tasks";
import { contacts } from "@/lib/db/schema/contacts";
import { activity_log } from "@/lib/db/schema/activity-log";
import { sendEmail } from "@/lib/channels/email/send";
import settingsRegistry from "@/lib/settings";
import { melbourneStartAndEndOfDay } from "@/lib/time/melbourne";

// ── Types ───────────────────────────────────────────────────────────

export interface TaskDigestItem {
  id: string;
  title: string;
  kind: string;
  priority: string;
  due_at_ms: number | null;
}

export interface ApprovalOutcomeItem {
  id: string;
  title: string;
  outcome: "approved" | "rejected";
  contactName: string | null;
  at_ms: number;
}

export interface TaskDigestContent {
  subject: string;
  bodyHtml: string;
  overdue: TaskDigestItem[];
  dueToday: TaskDigestItem[];
  approvalOutcomes: ApprovalOutcomeItem[];
}

/**
 * Check whether Andy has signed in between 00:00 and the given time
 * today (Melbourne). Uses `admin_session_started` activity log entries.
 */
export async function hasAdminSignedInToday(nowMs: number): Promise<boolean> {
  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const row = await db
    .select({ id: activity_log.id })
    .from(activity_log)
    .where(
      and(
        eq(activity_log.kind, "admin_session_started"),
        gte(activity_log.created_at_ms, startMs),
        lte(activity_log.created_at_ms, nowMs),
      ),
    )
    .limit(1)
    .get();
  return !!row;
}

// ── Query functions ────────────────────────────────────────────────

function toDigestItem(row: TaskRow): TaskDigestItem {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    priority: row.priority,
    due_at_ms: row.due_at_ms,
  };
}

export async function getOverdueTasks(nowMs: number): Promise<TaskDigestItem[]> {
  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const rows = await db.query.tasks.findMany({
    where: and(
      isNotNull(tasks.due_at_ms),
      lte(tasks.due_at_ms, startMs - 1),
      inArray(tasks.status, ["todo", "in_progress"]),
    ),
    orderBy: [tasks.due_at_ms],
  });
  return rows.map(toDigestItem);
}

export async function getDueTodayTasks(nowMs: number): Promise<TaskDigestItem[]> {
  const { startMs, endMs } = melbourneStartAndEndOfDay(nowMs);
  const rows = await db.query.tasks.findMany({
    where: and(
      isNotNull(tasks.due_at_ms),
      gte(tasks.due_at_ms, startMs),
      lte(tasks.due_at_ms, endMs),
      inArray(tasks.status, ["todo", "in_progress"]),
    ),
    orderBy: [tasks.due_at_ms],
  });
  return rows.map(toDigestItem);
}

export async function getApprovalOutcomesSince(
  sinceMs: number,
): Promise<ApprovalOutcomeItem[]> {
  const approvedRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      approved_at_ms: tasks.approved_at_ms,
      approved_by_contact_id: tasks.approved_by_contact_id,
    })
    .from(tasks)
    .where(
      and(isNotNull(tasks.approved_at_ms), gte(tasks.approved_at_ms, sinceMs)),
    );

  const rejectedRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      rejected_at_ms: tasks.rejected_at_ms,
      approved_by_contact_id: tasks.approved_by_contact_id,
    })
    .from(tasks)
    .where(
      and(isNotNull(tasks.rejected_at_ms), gte(tasks.rejected_at_ms, sinceMs)),
    );

  const contactIds = new Set<string>();
  for (const r of [...approvedRows, ...rejectedRows]) {
    if (r.approved_by_contact_id) contactIds.add(r.approved_by_contact_id);
  }

  const contactNames = new Map<string, string>();
  if (contactIds.size > 0) {
    const contactRows = await db
      .select({ id: contacts.id, name: contacts.name })
      .from(contacts)
      .where(inArray(contacts.id, Array.from(contactIds)));
    for (const c of contactRows) {
      contactNames.set(c.id, c.name);
    }
  }

  const items: ApprovalOutcomeItem[] = [];

  for (const r of approvedRows) {
    items.push({
      id: r.id,
      title: r.title,
      outcome: "approved",
      contactName: r.approved_by_contact_id
        ? (contactNames.get(r.approved_by_contact_id) ?? null)
        : null,
      at_ms: r.approved_at_ms!,
    });
  }

  for (const r of rejectedRows) {
    items.push({
      id: r.id,
      title: r.title,
      outcome: "rejected",
      contactName: r.approved_by_contact_id
        ? (contactNames.get(r.approved_by_contact_id) ?? null)
        : null,
      at_ms: r.rejected_at_ms!,
    });
  }

  items.sort((a, b) => a.at_ms - b.at_ms);
  return items;
}

// ── Content builder ────────────────────────────────────────────────

/**
 * Build digest content. Returns null if there's nothing to report
 * (the "≥1 overdue, ≥1 due-today, OR ≥1 approval outcome" gate).
 *
 * @param nowMs - current UTC epoch ms
 * @param sinceMs - approval outcomes window start (default: 24h ago)
 */
export async function buildTaskDigestContent(
  nowMs: number,
  sinceMs?: number,
): Promise<TaskDigestContent | null> {
  const windowStart = sinceMs ?? nowMs - 24 * 60 * 60 * 1000;

  const [overdue, dueToday, approvalOutcomes] = await Promise.all([
    getOverdueTasks(nowMs),
    getDueTodayTasks(nowMs),
    getApprovalOutcomesSince(windowStart),
  ]);

  if (overdue.length === 0 && dueToday.length === 0 && approvalOutcomes.length === 0) {
    return null;
  }

  const subject = buildDigestSubject(overdue, dueToday, approvalOutcomes);
  const bodyHtml = buildDigestBodyHtml(overdue, dueToday, approvalOutcomes, nowMs);

  return { subject, bodyHtml, overdue, dueToday, approvalOutcomes };
}

// ── Send ───────────────────────────────────────────────────────────

export async function sendTaskDigestEmail(
  content: TaskDigestContent,
): Promise<{ sent: boolean; skipped?: boolean; reason?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";
  return sendEmail({
    to: adminEmail,
    subject: content.subject,
    body: content.bodyHtml,
    classification: "task_morning_digest",
    purpose: "task_morning_digest",
    tags: [{ name: "type", value: "task_digest" }],
  });
}

// ── Subject line ───────────────────────────────────────────────────

function buildDigestSubject(
  overdue: TaskDigestItem[],
  dueToday: TaskDigestItem[],
  outcomes: ApprovalOutcomeItem[],
): string {
  const parts: string[] = [];

  if (overdue.length > 0) {
    parts.push(
      `${overdue.length} overdue`,
    );
  }
  if (dueToday.length > 0) {
    parts.push(
      `${dueToday.length} due today`,
    );
  }
  if (outcomes.length > 0) {
    const approved = outcomes.filter((o) => o.outcome === "approved").length;
    const rejected = outcomes.filter((o) => o.outcome === "rejected").length;
    const bits: string[] = [];
    if (approved > 0) bits.push(`${approved} approved`);
    if (rejected > 0) bits.push(`${rejected} rejected`);
    parts.push(bits.join(", "));
  }

  if (parts.length === 0) return "Task digest — nothing to report.";

  return `Task digest — ${parts.join(", ")}.`;
}

// ── HTML body ──────────────────────────────────────────────────────

function buildDigestBodyHtml(
  overdue: TaskDigestItem[],
  dueToday: TaskDigestItem[],
  outcomes: ApprovalOutcomeItem[],
  nowMs: number,
): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const lines: string[] = [];

  lines.push(
    `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2a2420;">`,
  );
  lines.push(
    `<p style="font-size: 14px; color: #8c8279; margin: 0 0 24px;">SuperBad Lite — task digest</p>`,
  );

  if (overdue.length > 0) {
    lines.push(sectionHeader("Overdue"));
    for (const t of overdue) {
      lines.push(taskLine(t, appUrl, nowMs));
    }
  }

  if (dueToday.length > 0) {
    lines.push(sectionHeader("Today"));
    for (const t of dueToday) {
      lines.push(taskLine(t, appUrl, nowMs));
    }
  }

  if (outcomes.length > 0) {
    lines.push(sectionHeader("Approval news"));
    for (const o of outcomes) {
      const icon = o.outcome === "approved" ? "\u2713" : "\u2717";
      const name = o.contactName ? escapeHtml(o.contactName) : "Client";
      const title = escapeHtml(truncate(o.title, 50));
      const url = `${appUrl}/lite/tasks?open=${o.id}`;
      lines.push(
        `<p style="font-size: 15px; margin: 0 0 4px; color: #2a2420;"><a href="${url}" style="color: #2a2420; text-decoration: none;">${icon} ${name} — ${title}</a></p>`,
      );
    }
  }

  lines.push(
    `<p style="font-size: 12px; color: #b0a89e; margin: 32px 0 0;">Sent because you hadn't opened Lite yet this morning. You can turn this off in Settings.</p>`,
  );
  lines.push(`</div>`);

  return lines.join("\n");
}

function sectionHeader(label: string): string {
  return `<p style="font-size: 13px; font-weight: 600; color: #8c8279; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 8px;">${label}</p>`;
}

function taskLine(
  t: TaskDigestItem,
  appUrl: string,
  nowMs: number,
): string {
  const title = escapeHtml(truncate(t.title, 55));
  const url = `${appUrl}/lite/tasks?open=${t.id}`;
  const priorityMark = t.priority === "high" ? " !" : "";
  let dueLabel = "";
  if (t.due_at_ms != null) {
    const daysAgo = Math.floor((nowMs - t.due_at_ms) / (24 * 60 * 60 * 1000));
    if (daysAgo > 0) {
      dueLabel = ` <span style="color: #c2410c; font-size: 13px;">(${daysAgo}d overdue)</span>`;
    }
  }

  return `<p style="font-size: 15px; margin: 0 0 4px; color: #2a2420;"><a href="${url}" style="color: #2a2420; text-decoration: none;">${title}${priorityMark}${dueLabel}</a></p>`;
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
