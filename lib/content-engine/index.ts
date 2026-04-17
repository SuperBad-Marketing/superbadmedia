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

// Social draft generation (CE-5)
export {
  generateSocialDrafts,
  listSocialDrafts,
} from "./social-drafts";
export type { SocialDraftOutput, CarouselSlide, GenerateSocialResult } from "./social-drafts";

// Visual asset pipeline (CE-5)
export { generateVisualAssets, loadBrandVisualTokens } from "./visual-assets";
export type { VisualResult } from "./visual-assets";

// Social templates (CE-5)
export {
  renderTemplate,
  renderCarouselTemplate,
  PLATFORM_DIMENSIONS,
} from "./social-templates";
export type { BrandVisualTokens, TemplateInput, TemplateId, ImageDimensions } from "./social-templates";

// Image rendering (CE-5)
export { renderSocialImage, renderSocialImageBatch } from "./render-social-image";

// AI image generation (CE-5)
export { generateAiImage } from "./ai-image";

// Newsletter rewrite (CE-6)
export { rewriteForNewsletter, computeNextSendWindow } from "./newsletter-rewrite";
export type { NewsletterRewriteResult } from "./newsletter-rewrite";

// Asset storage (CE-5)
export { storeContentAsset, readContentAsset } from "./asset-storage";
