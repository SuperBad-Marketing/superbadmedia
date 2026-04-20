import type { TaskKind, TaskStatus } from "@/lib/db/schema/tasks";

const LEGAL_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ["in_progress", "blocked", "done", "cancelled"],
  in_progress: ["blocked", "awaiting_approval", "done", "cancelled"],
  blocked: ["todo", "in_progress", "cancelled"],
  awaiting_approval: ["in_progress", "delivered", "cancelled"],
  delivered: ["done"],
  done: [],
  cancelled: [],
};

const DELIVERABLE_ONLY_STATUSES: ReadonlySet<TaskStatus> = new Set([
  "awaiting_approval",
  "delivered",
]);

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: TaskStatus,
    public readonly to: TaskStatus,
    public readonly reason: string,
  ) {
    super(`Invalid transition ${from} → ${to}: ${reason}`);
    this.name = "InvalidTransitionError";
  }
}

export function validateTransition(
  from: TaskStatus,
  to: TaskStatus,
  kind: TaskKind,
): void {
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidTransitionError(
      from,
      to,
      `not a legal transition from "${from}"`,
    );
  }

  if (DELIVERABLE_ONLY_STATUSES.has(to) && kind !== "client_deliverable") {
    throw new InvalidTransitionError(
      from,
      to,
      `"${to}" is only valid for client_deliverable tasks`,
    );
  }
}

export function getLegalTransitions(
  from: TaskStatus,
  kind: TaskKind,
): TaskStatus[] {
  const all = LEGAL_TRANSITIONS[from];
  if (kind === "client_deliverable") {
    return [...all];
  }
  return all.filter((s) => !DELIVERABLE_ONLY_STATUSES.has(s));
}

export function isTerminal(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled";
}
