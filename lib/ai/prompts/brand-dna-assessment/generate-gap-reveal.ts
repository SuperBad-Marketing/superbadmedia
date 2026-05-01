import type { ViabilityProfile } from "@/lib/lead-gen/types";

interface GapRevealPromptInput {
  subjectName: string;
  businessName: string;
  track: string;
  topSignals: Array<{ tag: string; frequency: number; domain: string }>;
  sectionInsights: string[];
  enrichmentSummary: string;
  hasRichEnrichment: boolean;
}

export function buildGapRevealPrompt(input: GapRevealPromptInput): string {
  if (input.hasRichEnrichment) {
    return buildObservationsPrompt(input);
  }
  return buildQuestionsPrompt(input);
}

function buildObservationsPrompt(input: GapRevealPromptInput): string {
  const signals = input.topSignals
    .map((s) => `${s.tag.replace(/_/g, " ")} (${s.domain}, strength ${s.frequency})`)
    .join(", ");

  return `You are writing two short observations for ${input.businessName} (${input.subjectName}).

CONTEXT:
This person just completed a Brand DNA assessment. You now know their brand identity deeply. You also have data about their current online presence. Write two observations:

1. STRENGTH (1-2 sentences): Something their current online presence already does well that aligns with their Brand DNA. Be specific — name the platform or aspect. This must feel like genuine recognition, not flattery.

2. GAP (1-2 sentences): One place where their current presence doesn't yet reflect who their Brand DNA says they are. Frame it as an observation, not criticism. No "you should" or "you need to." Just name what you see.

BRAND DNA SIGNALS (ranked by strength):
${signals}

SECTION INSIGHTS FROM THEIR ASSESSMENT:
${input.sectionInsights.slice(0, 3).join("\n")}

CURRENT ONLINE PRESENCE:
${input.enrichmentSummary}

VOICE:
- Dry, observational. Not motivational, not critical.
- No jargon. No "leverage", "optimise", "unlock", "journey".
- No em dashes. Use commas or full stops.
- Australian English spelling.
- Every observation must connect to something real in the data. No vague generalisations.

OUTPUT FORMAT:
STRENGTH: [your sentence(s)]
GAP: [your sentence(s)]

Output ONLY the two labelled lines. No preamble, no sign-off.`;
}

function buildQuestionsPrompt(input: GapRevealPromptInput): string {
  const signals = input.topSignals
    .map((s) => `${s.tag.replace(/_/g, " ")} (${s.domain}, strength ${s.frequency})`)
    .join(", ");

  return `You are writing 2-3 reflective questions for ${input.businessName} (${input.subjectName}).

CONTEXT:
This person just completed a Brand DNA assessment. You know their brand identity deeply but don't have detailed data about their current online presence. Write questions that guide them to think about whether their current brand presence reflects who they actually are.

Each question should:
- Reference a specific Brand DNA signal or pattern from their results
- Be genuinely thought-provoking, not rhetorical
- Lead them to their own conclusion about whether there's a gap
- Feel like a conversation, not a quiz

BRAND DNA SIGNALS (ranked by strength):
${signals}

SECTION INSIGHTS FROM THEIR ASSESSMENT:
${input.sectionInsights.slice(0, 3).join("\n")}

VOICE:
- Dry, observational. Not motivational, not coaching.
- No jargon. No "leverage", "optimise", "unlock", "journey".
- No em dashes. Use commas or full stops.
- Australian English spelling.
- Second person ("you", "your"), direct.

OUTPUT FORMAT:
Q1: [question]
Q2: [question]
Q3: [question]

Output ONLY the labelled questions. No preamble, no sign-off. Q3 is optional — only include it if it adds something the first two don't cover.`;
}

export function buildEnrichmentSummary(data: ViabilityProfile | null): string {
  if (!data) return "No enrichment data available.";
  const parts: string[] = [];

  if (data.instagram) {
    const { follower_count, posts_last_30d, post_count } = data.instagram;
    const pieces: string[] = [];
    if (follower_count !== undefined) pieces.push(`${follower_count.toLocaleString()} followers`);
    if (post_count !== undefined) pieces.push(`${post_count} total posts`);
    if (posts_last_30d !== null && posts_last_30d !== undefined) pieces.push(`${posts_last_30d} posts in last 30 days`);
    if (pieces.length > 0) parts.push(`Instagram: ${pieces.join(", ")}.`);
  }

  if (data.facebook) {
    if (!data.facebook.has_active_page) {
      parts.push("Facebook: no active page.");
    } else {
      const pieces: string[] = [];
      if (data.facebook.follower_count) pieces.push(`${data.facebook.follower_count.toLocaleString()} followers`);
      if (data.facebook.posts_last_30d !== null) pieces.push(`${data.facebook.posts_last_30d} posts in last 30 days`);
      parts.push(`Facebook: ${pieces.length > 0 ? pieces.join(", ") : "page exists"}.`);
    }
  }

  if (data.maps) {
    const { review_count, rating, category } = data.maps;
    const pieces: string[] = [];
    if (category) pieces.push(category);
    if (rating !== null) pieces.push(`${rating} stars`);
    pieces.push(`${review_count} reviews`);
    parts.push(`Google Business: ${pieces.join(", ")}.`);
  }

  if (data.website) {
    const pieces: string[] = [];
    if (data.website.pagespeed_performance_score !== null) {
      pieces.push(`performance ${data.website.pagespeed_performance_score}/100`);
    }
    if (!data.website.has_about_page) pieces.push("no about page");
    if (data.website.stated_pricing_tier && data.website.stated_pricing_tier !== "unknown") {
      pieces.push(`${data.website.stated_pricing_tier} pricing tier`);
    }
    if (pieces.length > 0) parts.push(`Website: ${pieces.join(", ")}.`);
  }

  if (data.youtube) {
    if (data.youtube.video_count === 0) {
      parts.push("YouTube: no content.");
    } else {
      const pieces: string[] = [];
      if (data.youtube.subscriber_count) pieces.push(`${data.youtube.subscriber_count} subscribers`);
      pieces.push(`${data.youtube.video_count} videos`);
      parts.push(`YouTube: ${pieces.join(", ")}.`);
    }
  }

  if (data.linkedin) {
    if (!data.linkedin.has_active_page) {
      parts.push("LinkedIn: no active company page.");
    } else if (data.linkedin.follower_count) {
      parts.push(`LinkedIn: ${data.linkedin.follower_count} followers.`);
    }
  }

  if (data.website_content) {
    if (data.website_content.content_quality && data.website_content.content_quality !== "unknown") {
      parts.push(`Website content quality: ${data.website_content.content_quality}.`);
    }
  }

  return parts.length > 0 ? parts.join("\n") : "Limited online presence data available.";
}

export function hasRichEnrichment(data: ViabilityProfile | null): boolean {
  if (!data) return false;
  let signalCount = 0;
  if (data.instagram) signalCount++;
  if (data.facebook) signalCount++;
  if (data.maps) signalCount++;
  if (data.website) signalCount++;
  if (data.youtube) signalCount++;
  if (data.linkedin) signalCount++;
  return signalCount >= 2;
}
