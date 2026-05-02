import { createProject } from "@/lib/projects/queries";
import type { ParsedProjectIdea } from "@/lib/ai/parse-braindump-ideas";

export interface CommittedProject {
  id: string;
  title: string;
}

export async function commitProjectIdeas(
  ideas: ParsedProjectIdea[],
  userId: string,
): Promise<CommittedProject[]> {
  const results: CommittedProject[] = [];

  for (const idea of ideas) {
    const project = await createProject({
      title: idea.title,
      brain_dump: idea.description,
      created_by: userId,
    });

    results.push({ id: project.id, title: project.title });
  }

  return results;
}
