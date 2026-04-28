/**
 * Content Engine — research progress event bus.
 *
 * In-memory pub/sub for streaming keyword research progress to the
 * admin SSE endpoint. Each event describes the current stage for a
 * single keyword in the pipeline.
 */

export type ResearchStage =
  | "started"
  | "fetching_serp"
  | "scoring"
  | "generating_outline"
  | "keyword_done"
  | "keyword_skipped"
  | "keyword_error"
  | "complete";

export interface ResearchProgressEvent {
  companyId: string;
  stage: ResearchStage;
  totalKeywords: number;
  currentIndex: number;
  keyword: string | null;
  detail: string | null;
  error: string | null;
}

type Listener = (event: ResearchProgressEvent) => void;

const listeners = new Set<Listener>();

export function subscribeResearchProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitResearchProgress(event: ResearchProgressEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Never let a listener crash the pipeline.
    }
  }
}
