import { randomUUID } from "node:crypto";
import { eq, and, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_content_plans,
  instagram_strategy_reports,
  instagram_metrics_snapshots,
  instagram_audience_snapshots,
} from "@/lib/db/schema/instagram";
import {
  instagram_competitor_posts,
  instagram_inspiration_reactions,
  instagram_taste_profiles,
  instagram_watched_accounts,
  type EnhancedContentPlanSlot,
} from "@/lib/db/schema/instagram-competitive";
import { braindumps } from "@/lib/db/schema/braindumps";
import { tasks } from "@/lib/db/schema/tasks";
import { invokeLlmText } from "@/lib/ai/invoke";
import { getSuperbadBrandProfile } from "@/lib/quote-builder/superbad-brand-profile";
import { logActivity } from "@/lib/activity-log";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface StrategyInput {
  accountId: string;
  accountUsername: string;
}

export async function generateCompetitiveStrategy(
  input: StrategyInput,
): Promise<{ planId: string; reportId: string }> {
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 86_400_000;

  const [brandProfile, likedPosts, tasteProfile, recentDumps, latestMetrics, audienceData] =
    await Promise.all([
      getSuperbadBrandProfile(),
      fetchLikedInspirationPosts(),
      fetchLatestTasteProfile(),
      fetchRecentBraindumpIdeas(fourteenDaysAgo),
      fetchLatestMetrics(input.accountId),
      fetchAudienceData(input.accountId),
    ]);

  const hasSelfMetrics = latestMetrics !== null;

  const systemPrompt = buildSystemPrompt(
    brandProfile,
    likedPosts,
    tasteProfile,
    recentDumps,
    hasSelfMetrics,
    latestMetrics,
    audienceData,
    input.accountUsername,
  );

  const coldStart = !hasSelfMetrics;

  const userPrompt = `Generate a weekly Instagram content strategy and exactly 5 post briefs for @${input.accountUsername}. Today is ${new Date().toISOString().slice(0, 10)}.${coldStart ? "\n\nIMPORTANT: This is a COLD START — the account has no published posts. Follow the foundational post priorities from the system prompt. The first 3 posts must establish the brand before any regular weekly content." : ""}

Output valid JSON matching this schema:
{
  "week_theme": "one sentence framing the week's content direction",
  "strategic_rationale": "2-3 sentences explaining why these 5 posts in this order",
  "posts": [
    {
      "content_type": "carousel" | "single" | "reel" | "story",
      "topic": "one-line hook",
      "caption_direction": "1-2 sentence caption guidance",
      "creation_steps": [
        { "step": 1, "instruction": "specific action to take", "is_manual": false }
      ],
      "requires_manual_input": false,
      "manual_input_description": null,
      "estimated_minutes": 15,
      "inspiration_post_ids": []
    }
  ]
}

Rules:
- ${coldStart ? "Order foundational posts first (pinned intro → authority → brand identity), then regular content" : "Order posts with manual-input posts first (4-5 day lead time), studio-only posts last (1-2 days)"}
- At least one carousel, one single, and one reel if possible
- Creation steps must be specific enough that someone can follow them without thinking
- If a step requires recording video or taking photos, mark is_manual: true
- For studio-only posts, steps should reference Content Studio
- Reference liked inspiration posts by ID in inspiration_post_ids where relevant`;

  const raw = await invokeLlmText({
    job: "instagram-competitive-strategy",
    system: systemPrompt,
    prompt: userPrompt,
    maxTokens: 4096,
  });

  const cleaned = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as {
    week_theme: string;
    strategic_rationale: string;
    posts: Array<{
      content_type: string;
      topic: string;
      caption_direction: string;
      creation_steps: Array<{ step: number; instruction: string; is_manual: boolean }>;
      requires_manual_input: boolean;
      manual_input_description: string | null;
      estimated_minutes: number;
      inspiration_post_ids: string[];
    }>;
  };

  const reportId = randomUUID();
  await db.insert(instagram_strategy_reports).values({
    id: reportId,
    account_id: input.accountId,
    report_type: "weekly_digest",
    generated_at_ms: now,
    summary_text: parsed.week_theme,
    recommendations_json: { rationale: parsed.strategic_rationale },
    content_ideas_json: parsed.posts,
  });

  const { start: weekStart, end: weekEnd } = getWeekBounds(new Date());
  const dates = assignDates(5, weekStart, parsed.posts);

  const slots: EnhancedContentPlanSlot[] = parsed.posts.map((post, i) => ({
    index: i,
    suggested_date: dates[i].date,
    day_of_week: dates[i].day,
    content_type: normalizeContentType(post.content_type),
    topic: post.topic,
    caption_direction: post.caption_direction,
    creation_steps: post.creation_steps,
    requires_manual_input: post.requires_manual_input,
    manual_input_description: post.manual_input_description,
    status: "pending" as const,
    task_id: null,
    ig_media_id: null,
    inspiration_post_ids: post.inspiration_post_ids ?? [],
    estimated_minutes: post.estimated_minutes ?? 15,
    approved: false,
  }));

  const planId = randomUUID();
  await db.insert(instagram_content_plans).values({
    id: planId,
    account_id: input.accountId,
    strategy_report_id: reportId,
    week_start_date: weekStart,
    week_end_date: weekEnd,
    theme_summary: parsed.week_theme,
    slots_json: slots,
    status: "awaiting_review",
    nudge_sent: false,
    created_at_ms: now,
    updated_at_ms: now,
  });

  const adminUser = await db
    .select({ id: tasks.created_by })
    .from(tasks)
    .limit(1)
    .get();
  const createdBy = adminUser?.id ?? "admin-dev-01";

  for (const slot of slots) {
    const taskId = randomUUID();
    const dueMs = new Date(slot.suggested_date + "T10:00:00+10:00").getTime();

    await db.insert(tasks).values({
      id: taskId,
      title: `Instagram: ${slot.topic}`,
      body: buildTaskBody(slot),
      kind: "admin",
      status: "todo",
      priority: slot.requires_manual_input ? "normal" : "low",
      due_at_ms: dueMs,
      created_at_ms: now,
      updated_at_ms: now,
      created_by: createdBy,
    });

    slot.task_id = taskId;
  }

  await db
    .update(instagram_content_plans)
    .set({ slots_json: slots, updated_at_ms: Date.now() })
    .where(eq(instagram_content_plans.id, planId));

  await logActivity({
    kind: "instagram_cold_start_strategy_generated",
    body: `Instagram strategy generated for @${input.accountUsername} — ${slots.length} posts planned.`,
    meta: {
      plan_id: planId,
      report_id: reportId,
      account_id: input.accountId,
      post_count: slots.length,
      has_self_metrics: hasSelfMetrics,
    },
  });

  return { planId, reportId };
}

function buildSystemPrompt(
  brandProfile: { voiceDescription: string; toneMarkers: string[]; avoidWords?: string[] },
  likedPosts: Array<{ id: string; caption: string | null; mediaType: string; likes: number; comments: number; finalScore: number; accountUsername: string }>,
  tasteProfile: { preferred_types_json: unknown; preferred_topics_json: unknown; anti_patterns_json: unknown } | null,
  recentDumps: Array<{ content_ideas: unknown[]; script_ideas: unknown[] }>,
  hasSelfMetrics: boolean,
  latestMetrics: { followers: number; reach: number } | null,
  audienceData: unknown,
  username: string,
): string {
  let prompt = `You are generating a weekly Instagram content strategy for @${username} (SuperBad Marketing).

BRAND VOICE:
${brandProfile.voiceDescription}
Tone markers: ${brandProfile.toneMarkers.join(", ")}
Words to avoid: ${(brandProfile.avoidWords ?? []).join(", ")}

POSITIONING:
Entertainment-first marketing for businesses that actually have something to say. Content should feel like it was found, not targeted. High production, low ego — polished visuals with self-deprecating, human content inside them. Solo founder, no layers — Andy shoots, edits, and strategises.

CONTENT PHILOSOPHY:
- The entertainment anchor: every post must be something people want to watch, not skip. If it reads like marketing, it's wrong.
- Open with an observation, not a hook question. Never "Did you know...?" or "Here's 5 tips..."
- Dry, observational, self-deprecating, slow burn. Never explain the joke. Short sentences. Leave room for the mutter.
- The setup matters more than the punchline. Let the reader arrive at the insight themselves.
- No hashtag walls, no emoji abuse, no exclamation marks. If the client uses emoji first, mirror sparingly.
- Overall feeling: found, not targeted. Quietly confident. Warm not cold. Premium not corporate. Against the grain.

VISUAL IDENTITY — THIS IS NON-NEGOTIABLE:
- Typography IS the graphic. Headlines as visual elements, not decoration. Every post should feel like it belongs on a gallery wall, not a feed.
- 1970s warmth — retro geometry, tactile imperfection, warm palettes. Think Brenton Wood album covers, vintage Penguin paperbacks.
- Composition: Wes Anderson — intentional framing, generous negative space, controlled density.
- Photography: cinematic, candid over posed, real emotion over manufactured expression.
- Dark-background dominant: charcoal (#1A1A18) base, SuperBad Red (#B22848) accent, warm cream (#FDF5E6) text, retro pink (#F4A0B0) and orange (#F28C52) highlights.
- No stock photography. No generic marketing layouts. If it looks like a Canva template, kill it.

CONTENT FORMATS THAT WORK FOR THIS BRAND:
- Anti-motivation posts: premium typography that reframes grind as proof of progress. Dry, subversive takes on hustle culture. Singles or carousels.
- Behind-the-scenes: raw production footage, real shoots, the actual work — never staged "day in the life" content.
- Typography-forward statements: short, punchy observations in brand typefaces. The visual IS the text.
- Work showcase: let the production quality speak. Minimal caption. Cinematic stills or short edits.
- Observational humour: the setup-punchline-nothing-wasted structure. Jimmy Carr energy, not stand-up open mic.

CULTURAL REFERENCES TO CHANNEL:
- Wes Anderson: intentional framing, absurd premise delivered with complete sincerity
- The Office / Fawlty Towers: characters who know exactly what's happening and say nothing
- Jimmy Carr: setup, punchline, nothing wasted
- Brenton Wood: unexpected, warm, slightly left of field`;

  if (likedPosts.length > 0) {
    prompt += `\n\nLIKED INSPIRATION POSTS (Andy approved these — use them as direction):`;
    for (const p of likedPosts.slice(0, 10)) {
      prompt += `\n- [ID: ${p.id}] @${p.accountUsername} | ${p.mediaType} | ${p.likes} likes, ${p.comments} comments | Score: ${p.finalScore.toFixed(1)}×`;
      if (p.caption) {
        prompt += `\n  Caption: ${p.caption.slice(0, 200)}${p.caption.length > 200 ? "..." : ""}`;
      }
    }
  }

  if (tasteProfile) {
    prompt += `\n\nANDY'S TASTE PROFILE:`;
    if (tasteProfile.preferred_types_json)
      prompt += `\nPreferred types: ${JSON.stringify(tasteProfile.preferred_types_json)}`;
    if (tasteProfile.preferred_topics_json)
      prompt += `\nPreferred topics: ${JSON.stringify(tasteProfile.preferred_topics_json)}`;
    if (tasteProfile.anti_patterns_json)
      prompt += `\nDislikes: ${JSON.stringify(tasteProfile.anti_patterns_json)}`;
  }

  const allContentIdeas = recentDumps.flatMap((d) => d.content_ideas);
  const allScriptIdeas = recentDumps.flatMap((d) => d.script_ideas);

  if (allContentIdeas.length > 0 || allScriptIdeas.length > 0) {
    prompt += `\n\nRECENT BRAINDUMP IDEAS (Andy's own thoughts from the last 14 days):`;
    if (allContentIdeas.length > 0)
      prompt += `\nContent ideas: ${JSON.stringify(allContentIdeas.slice(0, 5))}`;
    if (allScriptIdeas.length > 0)
      prompt += `\nScript ideas: ${JSON.stringify(allScriptIdeas.slice(0, 3))}`;
  }

  if (hasSelfMetrics && latestMetrics) {
    prompt += `\n\nOWN METRICS:
Followers: ${latestMetrics.followers}
Reach (latest): ${latestMetrics.reach}`;
    if (audienceData) {
      prompt += `\nAudience: ${JSON.stringify(audienceData)}`;
    }
  } else {
    prompt += `\n\nCOLD START — NEW ACCOUNT WITH NO EXISTING POSTS:
This account has zero published posts. The first strategy must establish the account's foundation before any regular weekly content.

FOUNDATIONAL POST PRIORITIES (in this order):
1. PINNED INTRO POST — "Who we are" brand carousel. This gets pinned to the grid. Establishes identity, voice, and what followers can expect. Should feel like a confident opening statement, not a mission statement.
2. AUTHORITY / PROOF POST — Work samples, results, or behind-the-scenes that proves competence. Visual-heavy, minimal text. Let the work talk.
3. BRAND IDENTITY POST — A single or carousel that captures the brand's personality and visual style. The "vibe check" post. Think typography-forward or anti-motivation style.
4-5. First regular content posts — these can follow the normal weekly strategy once the foundation is laid.

Order all 5 posts so the foundational posts come first (they establish context for everything after). The first 3 posts should be studio-only (no manual shoots needed) so they can ship immediately.`;
  }

  return prompt;
}

function buildTaskBody(slot: EnhancedContentPlanSlot): string {
  let body = `${slot.caption_direction}\n\nContent type: ${slot.content_type}`;
  if (slot.requires_manual_input && slot.manual_input_description) {
    body += `\n\nManual input needed: ${slot.manual_input_description}`;
  }
  if (slot.creation_steps.length > 0) {
    body += `\n\nSteps:`;
    for (const step of slot.creation_steps) {
      body += `\n${step.step}. ${step.instruction}${step.is_manual ? " (manual)" : ""}`;
    }
  }
  return body;
}

async function fetchLikedInspirationPosts() {
  const rows = await db
    .select({
      id: instagram_competitor_posts.id,
      caption: instagram_competitor_posts.caption,
      mediaType: instagram_competitor_posts.media_type,
      likes: instagram_competitor_posts.likes,
      comments: instagram_competitor_posts.comments,
      finalScore: instagram_competitor_posts.final_score,
      watchedAccountId: instagram_competitor_posts.watched_account_id,
    })
    .from(instagram_competitor_posts)
    .innerJoin(
      instagram_inspiration_reactions,
      eq(
        instagram_competitor_posts.id,
        instagram_inspiration_reactions.competitor_post_id,
      ),
    )
    .where(eq(instagram_inspiration_reactions.reaction, "like"))
    .all();

  const accountIds = [...new Set(rows.map((r) => r.watchedAccountId))];
  const accountMap = new Map<string, string>();
  for (const aid of accountIds) {
    const acc = await db
      .select({ username: instagram_watched_accounts.username })
      .from(instagram_watched_accounts)
      .where(eq(instagram_watched_accounts.id, aid))
      .get();
    if (acc) accountMap.set(aid, acc.username);
  }

  return rows.map((r) => ({
    ...r,
    accountUsername: accountMap.get(r.watchedAccountId) ?? "unknown",
  }));
}

async function fetchLatestTasteProfile() {
  return db
    .select()
    .from(instagram_taste_profiles)
    .orderBy(desc(instagram_taste_profiles.generated_at_ms))
    .limit(1)
    .get() ?? null;
}

async function fetchRecentBraindumpIdeas(sinceMs: number) {
  const rows = await db
    .select({
      parsed_at_ms: braindumps.parsed_at_ms,
    })
    .from(braindumps)
    .where(gte(braindumps.created_at_ms, sinceMs))
    .all();

  return rows
    .filter((r) => r.parsed_at_ms)
    .map(() => ({
      content_ideas: [] as unknown[],
      script_ideas: [] as unknown[],
    }));
}

async function fetchLatestMetrics(accountId: string) {
  const row = await db
    .select({
      followers: instagram_metrics_snapshots.followers,
      reach: instagram_metrics_snapshots.reach,
    })
    .from(instagram_metrics_snapshots)
    .where(eq(instagram_metrics_snapshots.account_id, accountId))
    .orderBy(desc(instagram_metrics_snapshots.synced_at_ms))
    .limit(1)
    .get();

  if (!row) return null;
  return { followers: row.followers ?? 0, reach: row.reach ?? 0 };
}

async function fetchAudienceData(accountId: string) {
  const row = await db
    .select()
    .from(instagram_audience_snapshots)
    .where(eq(instagram_audience_snapshots.account_id, accountId))
    .orderBy(desc(instagram_audience_snapshots.synced_at_ms))
    .limit(1)
    .get();

  if (!row) return null;
  return {
    top_cities: row.top_cities_json,
    age_gender: row.age_gender_json,
    online_hours: row.online_hours_json,
  };
}

function getWeekBounds(refDate: Date): { start: string; end: string } {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMon = day === 0 ? 1 : 8 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

function assignDates(
  count: number,
  weekStart: string,
  posts: Array<{ requires_manual_input: boolean }>,
): { date: string; day: string }[] {
  const base = new Date(weekStart + "T00:00:00");
  const result: { date: string; day: string }[] = [];

  for (let i = 0; i < count; i++) {
    const post = posts[i];
    const offset = post?.requires_manual_input
      ? Math.min(i, 1)
      : 2 + Math.min(i, 4);
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    result.push({
      date: d.toISOString().slice(0, 10),
      day: DAY_NAMES[d.getDay()],
    });
  }

  return result;
}

function normalizeContentType(
  type: string,
): "carousel" | "single" | "reel" | "story" {
  const t = type.toLowerCase();
  if (t === "carousel") return "carousel";
  if (t === "reel") return "reel";
  if (t === "story") return "story";
  return "single";
}
