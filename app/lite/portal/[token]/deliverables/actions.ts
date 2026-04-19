"use server";

import { getPortalSession } from "@/lib/portal/guard";
import {
  approveDeliverable,
  rejectDeliverable,
} from "@/lib/tasks/portal";

export async function handleApprove(
  taskId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const session = await getPortalSession();
  if (!session) return { ok: false, reason: "No session." };

  return approveDeliverable(taskId, session.contactId);
}

export async function handleReject(
  taskId: string,
  feedback: string,
): Promise<{ ok: boolean; reason?: string }> {
  const session = await getPortalSession();
  if (!session) return { ok: false, reason: "No session." };

  if (!feedback.trim()) {
    return { ok: false, reason: "Feedback is required." };
  }

  return rejectDeliverable(taskId, session.contactId, feedback.trim());
}
