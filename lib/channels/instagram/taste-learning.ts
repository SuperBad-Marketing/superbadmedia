import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  instagram_competitor_posts,
  instagram_inspiration_reactions,
  instagram_taste_profiles,
} from "@/lib/db/schema/instagram-competitive";
import { instagram_watched_accounts } from "@/lib/db/schema/instagram-competitive";
import { invokeLlmText } from "@/lib/ai/invoke";
import { logActivity } from "@/lib/activity-log";

const MIN_REACTIONS_FOR_PROFILE = 20;

export async function shouldRegenerateTasteProfile(): Promise<boolean> {
  const reactionCount = await db
    .select({ id: instagram_inspiration_reactions.id })
    .from(instagram_inspiration_reactions)
    .all();

  if (reactionCount.length < MIN_REACTIONS_FOR_PROFILE) return false;

  const latest = await db
    .select({ reaction_count: instagram_taste_profiles.reaction_count })
    .from(instagram_taste_profiles)
    .orderBy(({ reaction_count }) => reaction_count)
    .limit(1)
    .get();

  if (!latest) return true;
  return reactionCount.length >= latest.reaction_count + 10;
}

export async function generateTasteProfile(): Promise<string> {
  const reactions = await db
    .select({
      postId: instagram_inspiration_reactions.competitor_post_id,
      reaction: instagram_inspiration_reactions.reaction,
    })
    .from(instagram_inspiration_reactions)
    .all();

  const postIds = reactions.map((r) => r.postId);
  const posts = await db
    .select()
    .from(instagram_competitor_posts)
    .all();

  const postMap = new Map(posts.map((p) => [p.id, p]));

  const accountIds = [...new Set(posts.map((p) => p.watched_account_id))];
  const accountMap = new Map<string, string>();
  for (const aid of accountIds) {
    const acc = await db
      .select({ username: instagram_watched_accounts.username })
      .from(instagram_watched_accounts)
      .where(eq(instagram_watched_accounts.id, aid))
      .get();
    if (acc) accountMap.set(aid, acc.username);
  }

  const liked: string[] = [];
  const disliked: string[] = [];

  for (const r of reactions) {
    const post = postMap.get(r.postId);
    if (!post) continue;
    const account = accountMap.get(post.watched_account_id) ?? "unknown";
    const summary = `@${account} | ${post.media_type} | ${post.likes} likes | Caption: ${(post.caption ?? "").slice(0, 150)}`;

    if (r.reaction === "like") liked.push(summary);
    else disliked.push(summary);
  }

  const prompt = `Analyse Andy's Instagram content taste based on his reactions to competitor posts.

LIKED POSTS (${liked.length}):
${liked.map((l, i) => `${i + 1}. ${l}`).join("\n")}

DISLIKED POSTS (${disliked.length}):
${disliked.map((d, i) => `${i + 1}. ${d}`).join("\n")}

Output valid JSON:
{
  "preferred_types": ["list of content types Andy gravitates toward — e.g. carousel, reel, single image"],
  "preferred_topics": ["list of topic themes Andy likes — e.g. behind-the-scenes, client results, industry commentary"],
  "preferred_styles": ["list of visual/tonal styles — e.g. minimal, typography-heavy, raw/authentic, polished"],
  "anti_patterns": ["list of things Andy consistently rejects — e.g. emoji-heavy, motivational quotes, stock photography"],
  "analysis": "2-3 sentence plain English summary of Andy's content taste"
}

Be specific and grounded in the data. Don't invent preferences that aren't supported by the reactions.`;

  const raw = await invokeLlmText({
    job: "instagram-taste-analysis",
    prompt,
    maxTokens: 1024,
  });

  const cleaned = raw.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(cleaned) as {
    preferred_types: string[];
    preferred_topics: string[];
    preferred_styles: string[];
    anti_patterns: string[];
    analysis: string;
  };

  const id = randomUUID();
  await db.insert(instagram_taste_profiles).values({
    id,
    generated_at_ms: Date.now(),
    reaction_count: reactions.length,
    preferred_types_json: parsed.preferred_types,
    preferred_topics_json: parsed.preferred_topics,
    preferred_styles_json: parsed.preferred_styles,
    anti_patterns_json: parsed.anti_patterns,
    raw_analysis_text: parsed.analysis,
  });

  await logActivity({
    kind: "instagram_taste_profile_generated",
    body: `Taste profile generated from ${reactions.length} reactions.`,
    meta: {
      profile_id: id,
      reaction_count: reactions.length,
      liked_count: liked.length,
      disliked_count: disliked.length,
    },
  });

  return id;
}
