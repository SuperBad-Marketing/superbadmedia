import type { ContentType } from "@/lib/db/schema/content-studio";
import type { ParsedContentIdea } from "./parse-braindump";
import type { MoodSignal } from "@/lib/db/schema/instagram-competitive";

export type ContentIdeaSummary = {
  id: string;
  summary: string;
  raw_fragment: string;
};

export type AnalyzedContent = {
  ideas: ContentIdeaSummary[];
  split_rationale: string;
};

export type KeywordResult = {
  idea_id: string;
  keyword: string;
};

export type OutlineSection = {
  section: string;
  key_points: string[];
};

export type OutlineResult = {
  idea_id: string;
  outline: OutlineSection[];
  word_count: number;
  snippet_opportunity: boolean;
};

export type BlogDraftResult = {
  idea_id: string;
  title: string;
  body_markdown: string;
  meta_description: string;
  slug: string;
  snippet_target_section: string | null;
};

export type DerivedSocialPost = {
  blog_idea_id: string;
  brief: string;
  content_type: ContentType;
  slide_count: number;
  confidence: number;
};

export type ParsedBlogIdea = {
  id: string;
  title: string;
  keyword: string;
  outline: OutlineSection[];
  word_count: number;
  body_markdown: string;
  meta_description: string;
  slug: string;
  snippet_target_section: string | null;
  enabled: boolean;
  social_posts: ParsedContentIdea[];
};

export type ContentParsedBraindump = {
  blog_ideas: ParsedBlogIdea[];
  split_rationale: string;
  global_confidence: number;
  mood_signal: MoodSignal | null;
};
