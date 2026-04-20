import type { TaskKind, TaskPriority, ChecklistItem } from "@/lib/tasks/types";

export type EntityCandidate = {
  type: string;
  id: string;
  name: string;
};

export type ParsedTask = {
  id: string;
  title: string;
  kind: TaskKind;
  priority: TaskPriority;
  due_at_ms: number | null;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  checklist: ChecklistItem[] | null;
  confidence: {
    title: number;
    kind: number;
    priority: number;
    due: number;
    entity: number;
  };
  alternatives?: {
    entity?: EntityCandidate[];
  };
};

export type ParsedBraindump = {
  tasks: ParsedTask[];
  global_confidence: number;
};

export type SurfaceContext = {
  surfaceType?: string;
  entityType?: string;
  entityId?: string;
};

/**
 * Stub — TM-4 replaces with real Haiku call via invokeLlmText.
 * Splits raw text by newlines; each non-empty line becomes a task.
 */
export async function parseBraindump(
  rawText: string,
  _surfaceContext?: SurfaceContext | null,
): Promise<ParsedBraindump> {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tasks: ParsedTask[] = lines.map((line, i) => ({
    id: `stub-${i}-${Date.now()}`,
    title: line,
    kind: "admin" as TaskKind,
    priority: "normal" as TaskPriority,
    due_at_ms: null,
    entity_type: null,
    entity_id: null,
    entity_name: null,
    checklist: null,
    confidence: {
      title: 0.5,
      kind: 0.3,
      priority: 0.3,
      due: 0,
      entity: 0,
    },
  }));

  return {
    tasks,
    global_confidence: 0.3,
  };
}
