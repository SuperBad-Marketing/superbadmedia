import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getProjectById } from "@/lib/projects/queries";
import { listTasks } from "@/lib/tasks/queries";
import { ProjectDetailClient } from "@/components/lite/admin/projects/project-detail-client";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const project = await getProjectById(id);
  return {
    title: project ? `SuperBad | ${project.title}` : "SuperBad | Project",
    robots: { index: false, follow: false },
  };
}

export default async function ProjectDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { id } = await props.params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const projectTasks = await listTasks({
    entity_type: "project",
    entity_id: id,
  });

  return <ProjectDetailClient project={project} tasks={projectTasks} />;
}
