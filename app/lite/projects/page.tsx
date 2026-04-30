import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listProjects } from "@/lib/projects/queries";
import { ProjectsPageClient } from "@/components/lite/admin/projects/projects-page-client";

export const metadata: Metadata = {
  title: "SuperBad | Projects",
  robots: { index: false, follow: false },
};

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const allProjects = await listProjects();

  const counts = {
    total: allProjects.length,
    active: allProjects.filter(
      (p) => p.status === "active" || p.status === "planning",
    ).length,
    ideas: allProjects.filter((p) => p.status === "idea").length,
  };

  return (
    <div>
      <ProjectsHeader
        totalCount={counts.total}
        activeCount={counts.active}
        ideaCount={counts.ideas}
      />
      <ProjectsPageClient projects={allProjects} />
    </div>
  );
}

function ProjectsHeader({
  totalCount,
  activeCount,
  ideaCount,
}: {
  totalCount: number;
  activeCount: number;
  ideaCount: number;
}) {
  return (
    <header className="px-4 pt-6 pb-5">
      <div
        className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "2px" }}
      >
        Admin · Projects
      </div>
      <h1
        className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.4px" }}
      >
        Projects
      </h1>
      <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
        Brain dump it, map it out, make it happen.{" "}
        <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
          {totalCount === 0
            ? "nothing here yet. got ideas?"
            : ideaCount > 0
              ? `${ideaCount} idea${ideaCount === 1 ? "" : "s"} waiting to be mapped out.`
              : "all projects have a plan."}
        </em>
      </p>
      <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
        <span
          className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {totalCount}
        </span>
        <span>total</span>
        {activeCount > 0 && (
          <>
            <span
              aria-hidden
              className="text-[color:var(--color-neutral-700)]"
            >
              ·
            </span>
            <span
              className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-pink)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {activeCount} active
            </span>
          </>
        )}
      </div>
    </header>
  );
}
