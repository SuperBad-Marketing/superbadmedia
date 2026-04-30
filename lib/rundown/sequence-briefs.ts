/**
 * Structured email briefs for the Rundown post-completion nurture sequence.
 *
 * Each brief defines:
 * - What the email must cover (sections with word-count targets)
 * - What CTA to land on
 * - What NOT to do
 *
 * The LLM fills the voice and personalisation using Brand DNA signals,
 * enrichment data, and business context. Briefs are NOT templates.
 */

export interface SequenceContext {
  firstName: string;
  businessName: string;
  track: "melbourne" | "non_melbourne";
  signalTags: string[];
  firstImpression: string | null;
  enrichmentSummary: EnrichmentSummary;
  icpScores: { saas: number; retainer: number; track: "saas" | "retainer" | null };
  revealUrl: string;
  trialShootUrl: string;
  productionUrl: string;
  previousEmailsContext: PreviousEmailContext[];
}

export interface EnrichmentSummary {
  instagramFollowers: number | null;
  instagramPostsLast30d: number | null;
  googleReviewCount: number | null;
  googleRating: number | null;
  websitePerformanceScore: number | null;
  hasAboutPage: boolean | null;
  facebookActive: boolean | null;
  facebookPostsLast30d: number | null;
  youtubeVideoCount: number | null;
}

export interface PreviousEmailContext {
  emailNumber: number;
  opened: boolean;
  clicked: boolean;
  clickedLinks: string[];
}

export function buildSystemPrompt(): string {
  return `You are Andy Robinson, founder of SuperBad Marketing (Melbourne, Australia). You are writing a personal follow-up email to someone who just completed your Brand DNA assessment.

Voice rules (non-negotiable):
- Dry, observational, self-deprecating. The humour comes from noticing things, not mocking them.
- Short sentences. Fragments are fine. One idea per sentence.
- Never use: "synergy", "leverage", "solutions", "unlock", "supercharge", "game-changer", "next-level", "passionate about", "dedicated to", "innovative", "seamless", "empower", "transform", "thought leader", "reach out", "journey", "space" (as in "the marketing space").
- No exclamation marks. Ever.
- No em dashes. Use commas, full stops, or restructure.
- No emoji.
- No "I hope this email finds you well" or any variation.
- Australian English spelling (colour, analyse, organise).
- Sign off as "Andy". No title, no logo, no footer.
- Every observation must connect to a service you actually offer (content creation, photography, video, brand strategy, social media management). Never point out problems you can't solve.

Format rules:
- Output ONLY the email subject line on the first line, then a blank line, then the email body in plain HTML (<p> tags only, inline styles for spacing).
- Keep paragraphs short. Max 2-3 sentences per <p> tag.
- No headers, no bold, no lists. Just paragraphs.`;
}

export function buildEmail1Prompt(ctx: SequenceContext): string {
  const enrichmentObs = buildEnrichmentObservations(ctx.enrichmentSummary);
  const tagContext = ctx.signalTags.length > 0
    ? `Their top Brand DNA signal tags: ${ctx.signalTags.slice(0, 5).join(", ")}.`
    : "";

  return `Write Email 1 of 3 in a post-Brand-DNA follow-up sequence.

RECIPIENT:
- Name: ${ctx.firstName}
- Business: ${ctx.businessName}
- Location track: ${ctx.track === "melbourne" ? "Melbourne area (trial shoot eligible)" : "Not in Melbourne (no trial shoot available yet)"}
${tagContext}
${ctx.firstImpression ? `- Their Brand DNA first impression: "${ctx.firstImpression}"` : ""}

ENRICHMENT FINDINGS (reference the 1-2 most relevant):
${enrichmentObs || "No enrichment data available. Skip enrichment references."}

STRUCTURE:
1. OPEN (50-80 words): Acknowledge they did the assessment. Reference something specific from their Brand DNA signals. Don't say "thanks for completing" or anything generic.
2. MIDDLE (80-120 words): Pick the 1-2 most relevant enrichment findings and frame them as missed opportunities specific to their brand. Every gap you mention must connect to something you'd actually fix — content creation, photography, video, social media presence, brand identity. Frame it as "here's what your brand DNA says about you, and here's what the outside world currently sees instead."
3. CLOSE (20-30 words): Link back to their Brand DNA reveal. No sales CTA. Just "worth another look if you haven't been back."

REVEAL URL: ${ctx.revealUrl}

DO NOT:
- Pitch anything. This email is observation only.
- Use the word "gap" or "audit".
- List findings as bullet points. Weave them into prose.
- Mention the trial shoot, production, or any offer.`;
}

export function buildEmail2Prompt(ctx: SequenceContext): string {
  const engagementContext = ctx.previousEmailsContext.length > 0
    ? buildEngagementContext(ctx.previousEmailsContext)
    : "";

  if (ctx.track === "melbourne") {
    return `Write Email 2 of 3 in a post-Brand-DNA follow-up sequence. Melbourne track.

RECIPIENT:
- Name: ${ctx.firstName}
- Business: ${ctx.businessName}
- Location: Melbourne area
- Brand DNA signals: ${ctx.signalTags.slice(0, 5).join(", ") || "none available"}
${ctx.firstImpression ? `- First impression: "${ctx.firstImpression}"` : ""}
${engagementContext}

STRUCTURE:
1. OPEN (40-60 words): No recap of the assessment. Start with an observation about their business that connects what you know about their brand identity to a real outcome. Something specific, not "your brand could be stronger."
2. MIDDLE (80-120 words): Describe the trial shoot. Real work, not a pitch meeting. 60 minutes on-site, we come to you. Short-form video, edited photographs, and a six-week marketing plan written specifically for their business, not a template. Reference what you'd specifically focus on for their brand based on their DNA and what you've seen. Make the plan sound like the real deliverable it is — something they could take and run with even if they never come back.
3. CLOSE (20-30 words): One CTA — the trial shoot page link. Keep it direct.
4. FOOTNOTE (one line only): "For brands ready to go bigger: ${ctx.productionUrl}"

TRIAL SHOOT URL: ${ctx.trialShootUrl}
PRODUCTION URL: ${ctx.productionUrl}

DO NOT:
- Recap what the Brand DNA assessment was.
- Say "book a call" or "let's chat". The CTA is the trial shoot page.
- Use the word "invest" or "investment".
- Over-explain the trial shoot. State what it is and move on.`;
  }

  return `Write Email 2 of 3 in a post-Brand-DNA follow-up sequence. Non-Melbourne track.

RECIPIENT:
- Name: ${ctx.firstName}
- Business: ${ctx.businessName}
- Location: Not in Melbourne
- Brand DNA signals: ${ctx.signalTags.slice(0, 5).join(", ") || "none available"}
${ctx.firstImpression ? `- First impression: "${ctx.firstImpression}"` : ""}
${engagementContext}

STRUCTURE:
1. OPEN (40-60 words): No recap of the assessment. Start with an observation about their business that connects what you know about their brand identity to a real outcome.
2. MIDDLE (80-120 words): Acknowledge distance. Frame SuperBad as the people who already understand their brand better than most agencies would after three meetings, because they just spent 10 minutes telling you who they are. You're building tools for businesses like theirs. Not vague "exciting things coming" — be specific: tools that turn brand identity into consistent content, that take the thinking out of what to post and how to say it. Invite them to reply if they want to be first to know when it's ready.
3. CLOSE (20-30 words): CTA is "reply to this email." Not a link, not a form. Just a reply.
4. FOOTNOTE (one line only): "For brands ready to go bigger: ${ctx.productionUrl}"

PRODUCTION URL: ${ctx.productionUrl}

DO NOT:
- Apologise for not being in their city.
- Promise anything specific about launch dates.
- Use "stay tuned" or "watch this space".`;
}

export function buildEmail3Prompt(ctx: SequenceContext): string {
  const engagementContext = ctx.previousEmailsContext.length > 0
    ? buildEngagementContext(ctx.previousEmailsContext)
    : "";

  const closeCta = ctx.track === "melbourne"
    ? `Melbourne: "if any of it stuck, book a shoot: ${ctx.trialShootUrl}. If not, the brand pack is yours either way."`
    : `Non-Melbourne: "if any of it stuck, reply to this email. If not, the brand pack is yours either way."`;

  return `Write Email 3 of 3 in a post-Brand-DNA follow-up sequence. Final email.

RECIPIENT:
- Name: ${ctx.firstName}
- Business: ${ctx.businessName}
- Location track: ${ctx.track === "melbourne" ? "Melbourne" : "Not in Melbourne"}
${engagementContext}

STRUCTURE:
- Entire email under 100 words. Short.
- Mention their Brand DNA reveal access expires in 20 days. Not a threat, just a fact. The brand pack PDF they already have doesn't expire.
- ${closeCta}

REVEAL URL: ${ctx.revealUrl}
${ctx.track === "melbourne" ? `TRIAL SHOOT URL: ${ctx.trialShootUrl}` : ""}

DO NOT:
- Recap the assessment or previous emails.
- Create false urgency. The expiry is real, state it plainly.
- Write more than 100 words. This email is short on purpose.
- Add a production footnote. Keep it clean.`;
}

function buildEnrichmentObservations(e: EnrichmentSummary): string {
  const obs: string[] = [];

  if (e.instagramPostsLast30d !== null) {
    if (e.instagramPostsLast30d === 0) {
      obs.push(`Instagram: no posts in the last 30 days${e.instagramFollowers !== null ? ` (${e.instagramFollowers.toLocaleString()} followers)` : ""}.`);
    } else if (e.instagramPostsLast30d <= 2) {
      obs.push(`Instagram: only ${e.instagramPostsLast30d} post${e.instagramPostsLast30d === 1 ? "" : "s"} in the last 30 days${e.instagramFollowers !== null ? ` (${e.instagramFollowers.toLocaleString()} followers)` : ""}.`);
    }
  } else if (e.instagramFollowers !== null && e.instagramFollowers < 500) {
    obs.push(`Instagram: ${e.instagramFollowers} followers. Still early.`);
  }

  if (e.googleReviewCount !== null && e.googleReviewCount < 10) {
    obs.push(`Google Reviews: ${e.googleReviewCount} review${e.googleReviewCount === 1 ? "" : "s"}.`);
  }

  if (e.websitePerformanceScore !== null && e.websitePerformanceScore < 50) {
    obs.push(`Website performance: ${e.websitePerformanceScore}/100 on mobile.`);
  }

  if (e.hasAboutPage === false) {
    obs.push("No about page found on the website.");
  }

  if (e.facebookActive === false) {
    obs.push("No active Facebook page.");
  } else if (e.facebookPostsLast30d !== null && e.facebookPostsLast30d === 0) {
    obs.push("Facebook page exists but hasn't posted recently.");
  }

  if (e.youtubeVideoCount !== null && e.youtubeVideoCount === 0) {
    obs.push("No YouTube content.");
  }

  return obs.join("\n");
}

function buildEngagementContext(emails: PreviousEmailContext[]): string {
  if (emails.length === 0) return "";
  const parts = emails.map((e) => {
    const status = e.opened
      ? e.clicked ? `opened and clicked (${e.clickedLinks.join(", ")})` : "opened but didn't click"
      : "not opened";
    return `Email ${e.emailNumber}: ${status}`;
  });
  return `\nPREVIOUS EMAIL ENGAGEMENT:\n${parts.join("\n")}\nUse this to calibrate tone. If they opened and clicked, they're interested — be more direct. If they haven't opened, keep it lighter.`;
}
