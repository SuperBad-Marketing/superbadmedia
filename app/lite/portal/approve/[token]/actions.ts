"use server";

import { approveDeliverable, validateApprovalToken, hashApprovalToken } from "@/lib/tasks/approve";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tasks";
import { eq } from "drizzle-orm";

export async function handleTokenApprove(
  taskId: string,
  contactId: string,
  rawToken: string,
): Promise<{ ok: boolean; reason?: string }> {
  const valid = await validateApprovalToken(rawToken);
  if (!valid || valid.task.id !== taskId) {
    return { ok: false, reason: "Token expired or invalid." };
  }

  const result = await approveDeliverable(taskId, contactId, "approve");
  return result;
}

export async function handleTokenReject(
  taskId: string,
  contactId: string,
  rawToken: string,
  feedback: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!feedback.trim()) {
    return { ok: false, reason: "Feedback is required." };
  }

  const valid = await validateApprovalToken(rawToken);
  if (!valid || valid.task.id !== taskId) {
    return { ok: false, reason: "Token expired or invalid." };
  }

  const result = await approveDeliverable(taskId, contactId, "reject", feedback);
  return result;
}
