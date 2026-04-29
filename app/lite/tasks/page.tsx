import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tasks/queries";
import { TasksPageClient } from "@/components/lite/admin/tasks/tasks-page-client";

export async function generateMetadata(): Promise<Metadata> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { title: "SuperBad | Tasks", robots: { index: false, follow: false } };
  }
  const allTasks = await listTasks();
  const overdue = allTasks.filter(
    (t) =>
      t.due_at_ms != null &&
      t.due_at_ms < Date.now() &&
      t.status !== "done" &&
      t.status !== "cancelled",
  ).length;
  const open = allTasks.filter(
    (t) => t.status !== "done" && t.status !== "cancelled",
  ).length;

  let title = "SuperBad | Tasks";
  if (overdue > 0) {
    title = `SuperBad | ${overdue} overdue`;
  } else if (open === 0) {
    title = "SuperBad | nothing's on fire";
  }

  return { title, robots: { index: false, follow: false } };
}

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const allTasks = await listTasks();

  const counts = {
    open: allTasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled",
    ).length,
    overdue: allTasks.filter(
      (t) =>
        t.due_at_ms != null &&
        t.due_at_ms < Date.now() &&
        t.status !== "done" &&
        t.status !== "cancelled",
    ).length,
    total: allTasks.length,
  };

  return (
    <div>
      <TasksHeader openCount={counts.open} overdueCount={counts.overdue} />
      <TasksPageClient tasks={allTasks} />
    </div>
  );
}

function TasksHeader({
  openCount,
  overdueCount,
}: {
  openCount: number;
  overdueCount: number;
}) {
  return (
    <header className="px-4 pt-6 pb-5">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Admin · Tasks
      </div>
      <h1
        className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.4px" }}
      >
        Tasks
      </h1>
      <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        Everything on the list, nothing in your head.{" "}
        <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
          {openCount === 0
            ? "no tasks. go outside."
            : overdueCount > 0
              ? `${overdueCount} overdue. you know what to do.`
              : "all current. rare."}
        </em>
      </p>
      <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        <span
          className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {openCount}
        </span>
        <span>open</span>
        {overdueCount > 0 && (
          <>
            <span
              aria-hidden
              className="text-[color:var(--color-neutral-700)]"
            >
              ·
            </span>
            <span
              className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {overdueCount} overdue
            </span>
          </>
        )}
      </div>
    </header>
  );
}
