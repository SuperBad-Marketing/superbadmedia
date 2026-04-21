import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tasks";
import { contacts } from "@/lib/db/schema/contacts";
import { threads, messages } from "@/lib/db/schema/messages";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { validateTransition } from "./transitions";
import { logActivity } from "@/lib/activity-log";
import { enqueueTask } from "@/lib/scheduled-tasks/enqueue";
import settings from "@/lib/settings";
import type { TaskRow, TaskStatus, TaskKind } from "@/lib/db/schema/tasks";
import type { SendEmailParams } from "@/lib/channels/email/send";

async function lazySendEmail(params: SendEmailParams) {
  const { sendEmail } = await import("@/lib/channels/email/send");
  return sendEmail(params);
}

export type ApprovalDecision = "approve" | "reject";

export type ApprovalResult =
  | { ok: true; task: TaskRow; alreadyProcessed?: boolean }
  | { ok: false; reason: string };

/**
 * Canonical deliverable approval primitive.
 *
 * The ONLY code path for deliverable approval — portal button and email
 * magic-link both call this. Forking is a code-review reject (spec §25).
 *
 * Idempotent: repeat calls with the same decision + caller return the
 * cached result without re-firing downstream effects.
 */
export async function approveDeliverable(
  taskId: string,
  contactId: string,
  decision: ApprovalDecision,
  feedback?: string | null,
): Promise<ApprovalResult> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
  });
  if (!task) return { ok: false, reason: "Task not found." };

  if (task.kind !== "client_deliverable") {
    return { ok: false, reason: "Only client_deliverable tasks support approval." };
  }

  // --- Idempotency: if already approved/rejected with same decision, return cached ---
  if (decision === "approve" && task.approved_at_ms && task.approved_by_contact_id === contactId) {
    return { ok: true, task, alreadyProcessed: true };
  }
  if (decision === "reject" && task.rejected_at_ms && task.status === "in_progress") {
    return { ok: true, task, alreadyProcessed: true };
  }

  if (task.status !== "awaiting_approval") {
    return { ok: false, reason: `Task is not awaiting approval (status: ${task.status}).` };
  }

  if (decision === "reject" && !feedback?.trim()) {
    return { ok: false, reason: "Feedback is required when rejecting." };
  }

  const now = Date.now();

  if (decision === "approve") {
    const targetStatus: TaskStatus = "delivered";
    validateTransition(
      task.status as TaskStatus,
      targetStatus,
      task.kind as TaskKind,
    );

    const [updated] = await db
      .update(tasks)
      .set({
        status: targetStatus,
        approved_at_ms: now,
        approved_by_contact_id: contactId,
        approval_token: null,
        updated_at_ms: now,
      })
      .where(eq(tasks.id, taskId))
      .returning();

    await logActivity({
      companyId: task.entity_type === "client" ? task.entity_id : null,
      contactId,
      kind: "task_approved",
      body: `Deliverable "${task.title}" approved`,
      meta: { taskId },
    });

    void sendApprovalOutcomeToAndy(task, "approved", contactId);

    return { ok: true, task: updated };
  }

  // --- Reject ---
  const targetStatus: TaskStatus = "in_progress";
  validateTransition(
    task.status as TaskStatus,
    targetStatus,
    task.kind as TaskKind,
  );

  const trimmedFeedback = feedback!.trim();

  const [updated] = await db
    .update(tasks)
    .set({
      status: targetStatus,
      rejected_at_ms: now,
      rejection_feedback: trimmedFeedback,
      approval_token: null,
      updated_at_ms: now,
    })
    .where(eq(tasks.id, taskId))
    .returning();

  await logActivity({
    companyId: task.entity_type === "client" ? task.entity_id : null,
    contactId,
    kind: "task_rejected",
    body: `Deliverable "${task.title}" rejected: ${trimmedFeedback}`,
    meta: { taskId, feedback: trimmedFeedback },
  });

  await createRejectionInboxMessage(task, contactId, trimmedFeedback);

  void sendApprovalOutcomeToAndy(task, "rejected", contactId, trimmedFeedback);

  return { ok: true, task: updated };
}

// ---------------------------------------------------------------------------
// Approval token lifecycle
// ---------------------------------------------------------------------------

export function generateApprovalToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashApprovalToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Issue an approval token for a task transitioning to `awaiting_approval`.
 * Stores the hash, sets expiry timestamps, and fires the approval request
 * email + enqueues the 48h reminder.
 */
export async function issueApprovalToken(
  taskId: string,
  targetContactId: string,
): Promise<{ rawToken: string }> {
  const { raw, hash } = generateApprovalToken();
  const now = Date.now();
  const ttlDays = await settings.get("tasks.deliverable_approval_token_ttl_days");

  await db
    .update(tasks)
    .set({
      approval_token: hash,
      approval_requested_at_ms: now,
      approved_by_contact_id: targetContactId,
      updated_at_ms: now,
    })
    .where(eq(tasks.id, taskId));

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });

  await logActivity({
    companyId: task?.entity_type === "client" ? task.entity_id : null,
    contactId: targetContactId,
    kind: "task_approval_requested",
    body: `Approval requested for "${task?.title}"`,
    meta: { taskId, tokenExpiryDays: ttlDays },
  });

  // Fire approval request email
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, targetContactId),
  });

  if (contact?.email) {
    const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/lite/portal/approve/${raw}`;

    await lazySendEmail({
      to: contact.email,
      subject: `Approval needed: ${task?.title ?? "Deliverable"}`,
      body: buildApprovalRequestEmailHtml(task?.title ?? "Deliverable", approvalUrl),
      classification: "deliverable_approval_request",
      purpose: "deliverable_approval_request",
      tags: [{ name: "task_id", value: taskId }],
    });
  }

  const approvalReminderHours = await settings.get("tasks.approval_reminder_hours");
  const reminderAtMs = now + approvalReminderHours * 60 * 60 * 1000;
  await enqueueTask({
    task_type: "deliverable_approval_reminder",
    runAt: reminderAtMs,
    payload: { taskId, contactId: targetContactId },
    idempotencyKey: `approval-reminder-${taskId}`,
  });

  return { rawToken: raw };
}

/**
 * Validate an approval token from a magic-link URL.
 * Returns the task if valid, or null if expired/invalid/consumed.
 */
export async function validateApprovalToken(
  rawToken: string,
): Promise<{ task: TaskRow; contactId: string } | null> {
  const hash = hashApprovalToken(rawToken);
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.approval_token, hash),
  });

  if (!task) return null;
  if (task.status !== "awaiting_approval") return null;

  // Check expiry
  if (task.approval_requested_at_ms) {
    const ttlDays = await settings.get("tasks.deliverable_approval_token_ttl_days");
    const expiresAtMs = task.approval_requested_at_ms + ttlDays * 24 * 60 * 60 * 1000;
    if (Date.now() > expiresAtMs) return null;
  }

  if (!task.approved_by_contact_id) return null;

  // Mark token as viewed
  if (!task.approval_viewed_at_ms) {
    await db
      .update(tasks)
      .set({ approval_viewed_at_ms: Date.now(), updated_at_ms: Date.now() })
      .where(eq(tasks.id, task.id));
  }

  return { task, contactId: task.approved_by_contact_id };
}

// ---------------------------------------------------------------------------
// 48h reminder handler (called by scheduled task worker)
// ---------------------------------------------------------------------------

export async function handleApprovalReminder(payload: {
  taskId: string;
  contactId: string;
}): Promise<void> {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, payload.taskId),
  });

  if (!task || task.status !== "awaiting_approval") return;
  if (task.approval_viewed_at_ms) return;

  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, payload.contactId),
  });
  if (!contact?.email) return;

  const approvalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/lite/portal/approve/recover`;

  await lazySendEmail({
    to: contact.email,
    subject: `Reminder: ${task.title} is waiting for your approval`,
    body: buildApprovalReminderEmailHtml(task.title, approvalUrl),
    classification: "deliverable_approval_reminder",
    purpose: "deliverable_approval_reminder",
    tags: [{ name: "task_id", value: task.id }],
  });
}

// ---------------------------------------------------------------------------
// Rejection → inbox message
// ---------------------------------------------------------------------------

async function createRejectionInboxMessage(
  task: TaskRow,
  contactId: string,
  feedback: string,
): Promise<void> {
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
  });

  const now = Date.now();
  const threadId = randomUUID();
  const messageId = randomUUID();

  await db.insert(threads).values({
    id: threadId,
    contact_id: contactId,
    company_id: task.entity_type === "client" ? task.entity_id : null,
    channel_of_origin: "task_feedback",
    subject: `Rejected: ${task.title}`,
    priority_class: "signal",
    last_message_at_ms: now,
    last_inbound_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });

  await db.insert(messages).values({
    id: messageId,
    thread_id: threadId,
    direction: "inbound",
    channel: "task_feedback",
    from_address: contact?.email ?? `contact:${contactId}`,
    to_addresses: ["andy@superbadmedia.com.au"],
    subject: `Rejected: ${task.title}`,
    body_text: feedback,
    priority_class: "signal",
    received_at_ms: now,
    created_at_ms: now,
    updated_at_ms: now,
  });
}

// ---------------------------------------------------------------------------
// Outcome email to Andy
// ---------------------------------------------------------------------------

async function sendApprovalOutcomeToAndy(
  task: TaskRow,
  outcome: "approved" | "rejected",
  contactId: string,
  feedback?: string,
): Promise<void> {
  const contact = await db.query.contacts.findFirst({
    where: eq(contacts.id, contactId),
  });
  const contactName = contact
    ? contact.name || contact.email || "Client"
    : "Client";

  const andyEmail = process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au";

  const subject =
    outcome === "approved"
      ? `✓ ${contactName} approved "${task.title}"`
      : `✗ ${contactName} rejected "${task.title}"`;

  const body =
    outcome === "approved"
      ? buildOutcomeEmailHtml(task.title, contactName, "approved")
      : buildOutcomeEmailHtml(task.title, contactName, "rejected", feedback);

  await lazySendEmail({
    to: andyEmail,
    subject,
    body,
    classification: "deliverable_approval_outcome",
    purpose: "deliverable_approval_outcome",
    tags: [{ name: "task_id", value: task.id }],
  });
}

// ---------------------------------------------------------------------------
// Email HTML builders (minimal; Content Engine can upgrade later)
// ---------------------------------------------------------------------------

function buildApprovalRequestEmailHtml(title: string, url: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <p style="font-size: 16px; color: #1a1a18; margin: 0 0 16px;">A deliverable is ready for your review.</p>
      <p style="font-size: 20px; font-weight: 600; color: #1a1a18; margin: 0 0 24px;">${escapeHtml(title)}</p>
      <a href="${escapeHtml(url)}" style="display: inline-block; background: #1a1a18; color: #fdf5e6; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Review &amp; Approve</a>
      <p style="font-size: 13px; color: #888; margin: 24px 0 0;">If you have questions, reply to this email.</p>
    </div>
  `;
}

function buildApprovalReminderEmailHtml(title: string, url: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <p style="font-size: 16px; color: #1a1a18; margin: 0 0 16px;">Just a nudge — this one's still waiting on you.</p>
      <p style="font-size: 20px; font-weight: 600; color: #1a1a18; margin: 0 0 24px;">${escapeHtml(title)}</p>
      <a href="${escapeHtml(url)}" style="display: inline-block; background: #1a1a18; color: #fdf5e6; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">Review now</a>
    </div>
  `;
}

function buildOutcomeEmailHtml(
  title: string,
  contactName: string,
  outcome: "approved" | "rejected",
  feedback?: string,
): string {
  const verb = outcome === "approved" ? "approved" : "rejected";
  const feedbackBlock = feedback
    ? `<blockquote style="border-left: 3px solid #b22848; padding: 8px 16px; margin: 16px 0; color: #555; font-style: italic;">${escapeHtml(feedback)}</blockquote>`
    : "";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
      <p style="font-size: 16px; color: #1a1a18; margin: 0 0 8px;">${escapeHtml(contactName)} ${verb}:</p>
      <p style="font-size: 20px; font-weight: 600; color: #1a1a18; margin: 0 0 16px;">${escapeHtml(title)}</p>
      ${feedbackBlock}
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
