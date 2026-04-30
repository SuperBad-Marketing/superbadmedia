import { randomUUID } from "node:crypto";
import { invokeLlmText } from "@/lib/ai/invoke";
import type { ProjectBreakdown, DraftTask } from "@/lib/db/schema/projects";

export async function generateProjectBreakdown(
  title: string,
  brainDump: string,
): Promise<{ breakdown: ProjectBreakdown; draftTasks: DraftTask[] }> {
  const prompt = `You are a project planning assistant. The user has a project idea and has brain-dumped their thoughts. Your job is to turn this into a structured, actionable project plan.

PROJECT TITLE: ${title}

BRAIN DUMP:
${brainDump}

Respond with ONLY valid JSON (no markdown fences, no commentary) in this exact shape:

{
  "summary": "A clear 2-3 sentence summary of what this project is and what success looks like.",
  "goals": ["Goal 1", "Goal 2", "Goal 3"],
  "phases": [
    {
      "name": "Phase name",
      "description": "What this phase accomplishes",
      "tasks": ["Specific actionable task 1", "Specific actionable task 2"]
    }
  ],
  "risks": ["Risk or blocker 1", "Risk or blocker 2"],
  "estimated_effort": "A realistic effort estimate (e.g. '2-3 weeks part-time', '1 month focused')"
}

Rules:
- Break the project into 2-5 logical phases
- Each phase should have 2-6 specific, actionable tasks
- Tasks should be concrete enough to put on a to-do list (not vague like "plan things")
- Be realistic about effort — this is for a solo operator, not a team
- Identify genuine risks, not generic ones
- If the brain dump is vague, fill in reasonable defaults but note assumptions in the summary`;

  const raw = await invokeLlmText({
    job: "project-breakdown",
    prompt,
    maxTokens: 4096,
  });

  const breakdown: ProjectBreakdown = JSON.parse(raw);

  const draftTasks: DraftTask[] = breakdown.phases.flatMap((phase) =>
    phase.tasks.map((taskTitle) => ({
      temp_id: randomUUID(),
      title: taskTitle,
      body: `Phase: ${phase.name}\n${phase.description}`,
      priority: "normal" as const,
      phase: phase.name,
      approved: false,
    })),
  );

  return { breakdown, draftTasks };
}
