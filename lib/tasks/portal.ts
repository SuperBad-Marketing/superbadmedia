/**
 * Portal-facing task query stubs.
 *
 * TM-1 replaces these with real queries against the `tasks` table.
 * CM-7b consumes the return types to build the deliverables UI.
 *
 * Owner: TM-1. Consumer: CM-7b portal deliverables page.
 */
import type { PortalTask } from "./types";

export async function getTasksForClientPortal(
  companyId: string,
  _options?: { kind?: Array<"client_deliverable" | "client_task"> },
): Promise<PortalTask[]> {
  void companyId;
  return [];
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function approveDeliverable(
  taskId: string,
  contactId: string,
): Promise<ApproveResult> {
  void taskId;
  void contactId;
  return { ok: false, reason: "Task Manager not yet built (TM-1)." };
}

export async function rejectDeliverable(
  taskId: string,
  contactId: string,
  feedback: string,
): Promise<ApproveResult> {
  void taskId;
  void contactId;
  void feedback;
  return { ok: false, reason: "Task Manager not yet built (TM-1)." };
}
