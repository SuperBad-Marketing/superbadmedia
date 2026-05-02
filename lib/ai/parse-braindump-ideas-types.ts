import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";

export type ParsedProjectIdea = {
  id: string;
  title: string;
  description: string;
  confidence: number;
};

export type IdeasParsedBraindump = {
  project_ideas: ParsedProjectIdea[];
  global_confidence: number;
  mood_signal: MoodSignal | null;
};
