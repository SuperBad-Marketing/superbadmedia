export const PROJECT_STATUSES = [
  "idea",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export interface ProjectBreakdown {
  summary: string;
  goals: string[];
  phases: {
    name: string;
    description: string;
    tasks: string[];
  }[];
  risks: string[];
  estimated_effort: string;
}

export interface DraftTask {
  temp_id: string;
  title: string;
  body: string | null;
  priority: "high" | "normal" | "low";
  phase: string;
  approved: boolean;
}
