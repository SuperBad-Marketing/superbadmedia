/**
 * Content Engine barrel — CE-3 (generation + review + publish).
 *
 * Downstream sessions (CE-4+) add their own exports here.
 */

// Research pipeline
export { runKeywordResearch, fetchSerpResults } from "./research";
export type { SerpResult, SerpSnapshot } from "./research";

// Rankability scoring
export {
  scoreKeywordRankability,
  computeAuthorityScore,
  isHighAuthority,
  analyseContentGaps,
  fetchAndExtractText,
} from "./rankability";
export type { RankabilityResult, ContentGap } from "./rankability";

// Topic queue
export {
  generateTopicOutline,
  listQueuedTopics,
  vetoTopic,
  pickNextTopic,
} from "./topic-queue";
export type { TopicOutline, OutlineSection } from "./topic-queue";

// Blog generation (CE-3)
export { generateBlogPost } from "./generate-blog-post";
export type { BlogPostDraft, GenerateResult } from "./generate-blog-post";

// Review + feedback (CE-3)
export {
  approveBlogPost,
  rejectAndRegenerate,
  getBlogPostFeedback,
  getBlogPostForReview,
  listPostsForReview,
} from "./review";
export type { FeedbackMessage, ApproveResult, RejectResult } from "./review";

// Scheduled generation bootstrap (CE-4)
export { ensureContentGenerationEnqueued } from "@/lib/scheduled-tasks/handlers/content-generate-draft";

// Publishing (CE-3)
export {
  publishBlogPost,
  resolveCompanyByDomain,
  getPublishedPost,
  listPublishedPosts,
} from "./publish";
export type { PublishResult } from "./publish";
