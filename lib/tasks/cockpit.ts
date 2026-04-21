import { and, inArray, lte, isNotNull, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, type TaskRow } from "@/lib/db/schema/tasks";
import { melbourneStartAndEndOfDay } from "@/lib/time/melbourne";

// ── Types matching Daily Cockpit spec §5 + §6 contracts ────────────

export interface CockpitKanban {
  mustDo: TaskRow[];
  shouldDo: TaskRow[];
  ifTime: TaskRow[];
}

export interface WaitingItem {
  id: string;
  label: string;
  href: string;
  urgency: {
    kind: "time_sensitive" | "age_of_wait";
    value: number;
  };
  scope: "own" | "fleet";
  source: string;
}

export interface HealthBanner {
  id: string;
  severity: "warning" | "critical";
  summary: string;
  href: string;
  source: string;
}

// ── Cockpit kanban column queries ──────────────────────────────────

export async function getTasksForCockpitKanban(
  nowMs: number = Date.now(),
): Promise<CockpitKanban> {
  const { startMs, endMs } = melbourneStartAndEndOfDay(nowMs);
  const weekEndMs = startMs + 7 * 24 * 60 * 60 * 1000;

  const openStatuses = ["todo", "in_progress"] as const;

  const allOpen = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.status, [...openStatuses]),
      isNotNull(tasks.due_at_ms),
    ),
    orderBy: [tasks.due_at_ms, tasks.priority],
  });

  const mustDo: TaskRow[] = [];
  const shouldDo: TaskRow[] = [];
  const ifTime: TaskRow[] = [];

  for (const t of allOpen) {
    const due = t.due_at_ms!;

    if (due < startMs || (due >= startMs && due <= endMs && t.priority === "high")) {
      mustDo.push(t);
    } else if (due >= startMs && due <= endMs && t.priority !== "high") {
      shouldDo.push(t);
    } else if (due > endMs && due <= weekEndMs && t.priority === "high") {
      ifTime.push(t);
    }
  }

  return { mustDo, shouldDo, ifTime };
}

// ── Waiting items (Daily Cockpit §5 attention rail) ────────────────

export async function getTaskWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const items: WaitingItem[] = [];

  const overdueTasks = await db.query.tasks.findMany({
    where: and(
      inArray(tasks.status, ["todo", "in_progress"]),
      isNotNull(tasks.due_at_ms),
      lte(tasks.due_at_ms, startMs - 1),
    ),
    orderBy: [tasks.due_at_ms],
  });

  for (const t of overdueTasks) {
    items.push({
      id: `task_overdue_${t.id}`,
      label: t.title,
      href: `/lite/tasks?open=${t.id}`,
      urgency: { kind: "time_sensitive", value: t.due_at_ms! },
      scope: "own",
      source: "task_manager",
    });
  }

  const awaitingReview = await db.query.tasks.findMany({
    where: and(
      eq(tasks.kind, "client_deliverable"),
      eq(tasks.status, "awaiting_approval"),
      isNotNull(tasks.approval_requested_at_ms),
    ),
    orderBy: [tasks.approval_requested_at_ms],
  });

  for (const t of awaitingReview) {
    items.push({
      id: `task_approval_${t.id}`,
      label: `Approval: ${t.title}`,
      href: `/lite/tasks?open=${t.id}`,
      urgency: { kind: "age_of_wait", value: t.approval_requested_at_ms! },
      scope: "own",
      source: "task_manager",
    });
  }

  return items;
}

// ── Health banners (Daily Cockpit §6 banner strip) ─────────────────

export async function getTaskHealthBanners(
  nowMs: number = Date.now(),
): Promise<HealthBanner[]> {
  const { startMs } = melbourneStartAndEndOfDay(nowMs);
  const banners: HealthBanner[] = [];

  const overdueCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        inArray(tasks.status, ["todo", "in_progress"]),
        isNotNull(tasks.due_at_ms),
        lte(tasks.due_at_ms, startMs - 1),
      ),
    )
    .get();

  const count = overdueCount?.count ?? 0;

  if (count > 0) {
    banners.push({
      id: "task_overdue_count",
      severity: count >= 5 ? "critical" : "warning",
      summary: `${count} overdue task${count === 1 ? "" : "s"}`,
      href: "/lite/tasks?due=overdue",
      source: "task_manager",
    });
  }

  return banners;
}
