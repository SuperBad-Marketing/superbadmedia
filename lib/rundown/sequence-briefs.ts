/**
 * Structured email briefs for the Rundown post-completion nurture sequence.
 *
 * 12-email progressive disclosure sequence. Each email re-presents a
 * different piece of the Brand DNA reveal with deeper context, teaching
 * the recipient something new about their own brand each time.
 *
 * CTA rhythm:
 * - Most emails: subtle "book your trial shoot" in footer signature
 * - Every 3rd-4th email: proper (but understated) CTA reminder
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
  gapReveal: { mode: string; strength?: string; gap?: string; questions?: string[] } | null;
  signalDescriptions: Record<string, string>;
  prosePortrait: string | null;
  sectionInsights: string[];
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
- First person is the warmth. Lean into "I" — "I spent", "I went looking", "I curated". Don't strip it for brevity.
- Narrative patience. Alternate between short and long sentences. Not everything is a fragment. "So I decided to build the thing I needed instead." is a complete, unhurried sentence.
- Parenthetical asides for dry comments — "(As you do)" on its own line. A thought said under the breath.
- Use "so" as a natural connector — "so I went looking", "So I decided." Don't fragment these.
- Ellipsis (…) before a pivot or reveal. No em dashes. Use commas, full stops, or restructure.
- Never use: "synergy", "leverage", "solutions", "unlock", "supercharge", "game-changer", "next-level", "passionate about", "dedicated to", "innovative", "seamless", "empower", "transform", "thought leader", "reach out", "journey", "space" (as in "the marketing space").
- No exclamation marks. Ever.
- No emoji.
- No "I hope this email finds you well" or any variation.
- Australian English spelling (colour, analyse, organise).
- Sign off as "Andy". No title, no logo.
- Every observation must connect to a service you actually offer (content creation, photography, video, brand strategy, social media management). Never point out problems you can't solve.

Format rules:
- Output ONLY the email subject line on the first line, then a blank line, then the email body in plain HTML (<p> tags only, inline styles for spacing).
- Keep paragraphs short. Max 2-3 sentences per <p> tag.
- No headers, no bold, no lists. Just paragraphs.`;
}

function ctaInstruction(emailNumber: number, ctx: SequenceContext): string {
  const isProperCta = emailNumber % 3 === 0 || emailNumber === 1;

  if (ctx.track === "non_melbourne") {
    if (isProperCta) {
      return `CTA: Invite them to reply to this email if they want to talk about their brand. Not a link, not a form. Just a reply.`;
    }
    return `FOOTER: End with "Andy" then on a new line: "P.S. — Your Brand DNA is still here: ${ctx.revealUrl}"`;
  }

  if (isProperCta) {
    return `CTA: Include a single contextual line about the 60-minute trial shoot session. Don't pitch. Just name what it is and link to it: ${ctx.trialShootUrl}`;
  }
  return `FOOTER: Sign off as "Andy" then on a new line in smaller text: "book your trial shoot — ${ctx.trialShootUrl}"`;
}

export function buildEmailPrompt(emailNumber: number, ctx: SequenceContext): string {
  const engagementContext = ctx.previousEmailsContext.length > 0
    ? buildEngagementContext(ctx.previousEmailsContext)
    : "";

  const cta = ctaInstruction(emailNumber, ctx);
  const base = buildBaseContext(ctx);

  if (emailNumber === 1) return buildEmail1(ctx, base, engagementContext, cta);
  if (emailNumber === 2) return buildEmail2(ctx, base, engagementContext, cta);
  return buildProgressiveEmail(emailNumber, ctx, base, engagementContext, cta);
}

// Keep legacy exports for backward compat with handler
export const buildEmail1Prompt = (ctx: SequenceContext) => buildEmailPrompt(1, ctx);
export const buildEmail2Prompt = (ctx: SequenceContext) => buildEmailPrompt(2, ctx);
export const buildEmail3Prompt = (ctx: SequenceContext) => buildEmailPrompt(3, ctx);

function buildBaseContext(ctx: SequenceContext): string {
  return `RECIPIENT:
- Name: ${ctx.firstName}
- Business: ${ctx.businessName}
- Location track: ${ctx.track === "melbourne" ? "Melbourne area (trial shoot eligible)" : "Not in Melbourne (no trial shoot available yet)"}
- Brand DNA signals: ${ctx.signalTags.slice(0, 5).join(", ") || "none available"}
${ctx.firstImpression ? `- First impression: "${ctx.firstImpression}"` : ""}`;
}

function buildEmail1(ctx: SequenceContext, base: string, engagement: string, cta: string): string {
  const enrichmentObs = buildEnrichmentObservations(ctx.enrichmentSummary);
  const gapContext = ctx.gapReveal
    ? ctx.gapReveal.mode === "observations"
      ? `\nGAP REVEAL (reference these):\n- Strength: ${ctx.gapReveal.strength}\n- Gap: ${ctx.gapReveal.gap}`
      : `\nREFLECTIVE QUESTIONS (from their reveal):\n${ctx.gapReveal.questions?.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  return `Write Email 1 of 12 in a post-Brand-DNA follow-up sequence. This is the first email, sent 3 hours after they finished.

${base}
${engagement}
${gapContext}

ENRICHMENT FINDINGS:
${enrichmentObs || "No enrichment data available."}

STRUCTURE:
1. OPEN (50-80 words): Acknowledge they did the assessment. Their Brand Pack is attached/available. Reference their gap reveal observations if available. Don't say "thanks for completing" or anything generic.
2. MIDDLE (80-120 words): Reference the strength and gap from their reveal. Frame the gap as observation, not criticism. If no gap reveal data, reference 1-2 enrichment findings.
3. CLOSE (20-30 words): Link back to their Brand DNA reveal. "Worth another look when you've got a quiet minute."

REVEAL URL: ${ctx.revealUrl}

${cta}

DO NOT:
- Use the word "gap" or "audit".
- List findings as bullet points. Weave them into prose.`;
}

function buildEmail2(ctx: SequenceContext, base: string, engagement: string, cta: string): string {
  const focusSignal = ctx.signalTags[0] ?? "their strongest signal";
  const desc = ctx.signalDescriptions[ctx.signalTags[0]] ?? "";

  return `Write Email 2 of 12 in a post-Brand-DNA follow-up sequence. Sent 48 hours after completion.

${base}
${engagement}

PROGRESSIVE DISCLOSURE FOCUS:
Their top Brand DNA signal is "${focusSignal}". ${desc ? `Context: "${desc}"` : ""}
This email teaches them something about this signal they might have scrolled past in the reveal. Go deeper on what this signal means for a brand like theirs, practically. What does a business that scores high on this signal typically do well? What do they typically undervalue?

STRUCTURE:
1. OPEN (30-50 words): No recap. Start with the signal observation directly.
2. MIDDLE (100-150 words): The deeper insight. Specific, practical, connected to their business.
3. CLOSE (20-30 words): "Your full results are still here: ${ctx.revealUrl}"

${cta}

DO NOT:
- Recap what the Brand DNA assessment was.
- Mention the trial shoot or any offer in the body (the CTA/footer handles that).`;
}

function buildProgressiveEmail(
  emailNumber: number,
  ctx: SequenceContext,
  base: string,
  engagement: string,
  cta: string,
): string {
  const angles = getProgressiveAngle(emailNumber, ctx);

  return `Write Email ${emailNumber} of 12 in a post-Brand-DNA follow-up sequence.

${base}
${engagement}

PROGRESSIVE DISCLOSURE FOCUS:
${angles.focus}

${angles.instruction}

STRUCTURE:
- Total length: ${emailNumber >= 8 ? "60-100" : "100-150"} words. ${emailNumber >= 8 ? "Shorter as the sequence matures." : ""}
- No recap of the assessment or previous emails.
- One clear insight or observation. Teach them something.
- ${angles.closeInstruction || `Close with: "Your full results: ${ctx.revealUrl}"`}

${cta}

DO NOT:
- Recap what the Brand DNA assessment was.
- Reference previous emails by number ("in my last email").
- Create false urgency.
- Write more than ${emailNumber >= 8 ? "100" : "150"} words.`;
}

interface ProgressiveAngle {
  focus: string;
  instruction: string;
  closeInstruction?: string;
}

function getProgressiveAngle(emailNumber: number, ctx: SequenceContext): ProgressiveAngle {
  const signalIdx = Math.min(emailNumber - 2, ctx.signalTags.length - 1);
  const signal = ctx.signalTags[Math.max(signalIdx, 0)] ?? "their brand identity";
  const desc = ctx.signalDescriptions[ctx.signalTags[Math.max(signalIdx, 0)]] ?? "";
  const insights = ctx.sectionInsights;

  switch (emailNumber) {
    case 3:
      return {
        focus: `Section insight: "${insights[0] ?? "their brand values"}"`,
        instruction: "Expand on this section insight. What does it reveal about how they make decisions? Connect it to something observable about their business.",
      };
    case 4:
      return {
        focus: `Signal "${signal}" (their ${emailNumber - 1}th strongest signal). ${desc ? `"${desc}"` : ""}`,
        instruction: "This email is a proper CTA email. Lead with the signal insight but connect it to why having professional content matters for a brand with this identity. The CTA should feel earned by the observation.",
      };
    case 5:
      return {
        focus: `Section insight: "${insights[1] ?? "their communication style"}"`,
        instruction: "How does this insight show up in practice? Give them a concrete example of what a brand with this trait does differently in their content.",
      };
    case 6:
      return {
        focus: `The combination of their top 2 signals: ${ctx.signalTags.slice(0, 2).join(" + ")}`,
        instruction: "This is a proper CTA email. Explore what makes this combination interesting or unusual. Most brands lean one way or the other. What does having both mean? Connect to the trial shoot naturally.",
      };
    case 7:
      return {
        focus: `Section insight: "${insights[2] ?? "their creative direction"}"`,
        instruction: "This insight reveals something about their aesthetic preferences. What kind of content would feel most authentic to this brand? Be specific.",
      };
    case 8:
      return {
        focus: ctx.prosePortrait
          ? `A line from their prose portrait: "${ctx.prosePortrait.split(". ").slice(0, 2).join(". ")}"`
          : `Their overall brand identity pattern`,
        instruction: "Pull one thread from their portrait and expand on it. What does this say about them that they might not have noticed? Keep it short, this email is past the halfway point.",
      };
    case 9:
      return {
        focus: `Signal "${ctx.signalTags[3] ?? signal}". ${ctx.signalDescriptions[ctx.signalTags[3] ?? ""] ?? ""}`,
        instruction: "This is a proper CTA email. This is a signal they might not have paid attention to. Name it, explain why it matters, connect to the shoot. Keep it under 80 words.",
        closeInstruction: `Direct CTA: ${ctx.trialShootUrl}`,
      };
    case 10:
      return {
        focus: `Their reveal access expires in ~8 days.`,
        instruction: "Mention the expiry as a fact, not a threat. The Brand Pack PDF they have doesn't expire. The interactive reveal does. Short email.",
        closeInstruction: `Reveal link: ${ctx.revealUrl}`,
      };
    case 11:
      return {
        focus: ctx.gapReveal?.mode === "observations"
          ? `Revisit the gap: "${ctx.gapReveal.gap}"`
          : `Their brand identity is still untapped`,
        instruction: "This is near the end of the sequence. Be direct without being pushy. If they haven't acted, they might not. That's fine. But name the gap one more time.",
      };
    case 12:
      return {
        focus: "Final email in the sequence.",
        instruction: "Short. Under 60 words. No recap. No guilt. Just: we built something for you, it's still here, and if the timing is ever right, so are we. This is a proper CTA email. Sign off warmly.",
        closeInstruction: ctx.track === "melbourne"
          ? `"${ctx.trialShootUrl}" — if the timing's right.`
          : `"reply to this email" — if the timing's right.`,
      };
    default:
      return {
        focus: `Signal "${signal}"`,
        instruction: "Explore this signal. Keep it short. One insight, one close.",
      };
  }
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
