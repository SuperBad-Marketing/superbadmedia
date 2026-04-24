"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { instagram_accounts } from "@/lib/db/schema/instagram";
import { contentStudioRenders } from "@/lib/db/schema/content-studio";
import { publishSingleImage, publishCarousel } from "@/lib/channels/instagram/publish";
import { invokeLlmText } from "@/lib/ai/invoke";

type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function listInstagramAccountsAction(): Promise<
  ActionResult<{ id: string; username: string; account_type: string }[]>
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const accounts = await db
    .select({
      id: instagram_accounts.id,
      username: instagram_accounts.username,
      account_type: instagram_accounts.account_type,
    })
    .from(instagram_accounts)
    .where(eq(instagram_accounts.status, "active"))
    .all();

  return { ok: true, value: accounts };
}

export async function draftInstagramCaptionAction(input: {
  brief: string;
  copySlides: Record<string, string>[];
  contentType: string;
}): Promise<ActionResult<{ caption: string; driftScore: number; driftPass: boolean; driftNotes: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const slideSummary = input.copySlides
    .map((slide, i) => {
      const parts = Object.entries(slide)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      return `Slide ${i + 1}: ${parts}`;
    })
    .join("\n");

  const prompt = `You are writing an Instagram caption for SuperBad Marketing (@superbadmarketing).

VOICE RULES:
- Dry, observational, self-deprecating, slow burn. Never explain the joke.
- Short sentences. Leave room for the mutter. Fragments are fine.
- NEVER use: "synergy", "leverage", "solutions", "unlock", "supercharge", "game-changer", "passionate about", "innovative", "seamless", "empower", "thought leader", exclamation marks.
- Open with an observation, not a hook question.
- No "DM me for..." calls to action.
- Hashtags: 0-2 max. Only #superbadmarketing if any.
- No emoji-heavy openers. One emoji max per caption, and only if it adds something.
- End on a thought, not a demand.

CONTENT TYPE: ${input.contentType.replace(/_/g, " ")}

BRIEF: ${input.brief}

POST COPY:
${slideSummary}

Write the Instagram caption. Then on a new line, output a JSON object with your self-assessment:
{"drift_score": 0.0-1.0, "drift_pass": true/false, "drift_notes": "brief note on voice compliance"}

The drift score should be 0.85+ if on-voice, 0.70-0.84 for minor drift, below 0.70 for off-voice.`;

  try {
    const raw = await invokeLlmText({ job: "instagram-draft-caption", prompt, maxTokens: 1024 });

    const jsonMatch = raw.match(/\{[\s\S]*"drift_score"[\s\S]*\}/);
    let driftScore = 0.85;
    let driftPass = true;
    let driftNotes = "On voice";

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as {
          drift_score?: number;
          drift_pass?: boolean;
          drift_notes?: string;
        };
        driftScore = parsed.drift_score ?? 0.85;
        driftPass = parsed.drift_pass ?? driftScore >= 0.70;
        driftNotes = parsed.drift_notes ?? "On voice";
      } catch {
        // Use defaults
      }
    }

    const caption = raw
      .replace(/\{[\s\S]*"drift_score"[\s\S]*\}/, "")
      .trim();

    return {
      ok: true,
      value: { caption, driftScore, driftPass, driftNotes },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Caption generation failed.",
    };
  }
}

export async function postToInstagramAction(input: {
  accountId: string;
  postId: string;
  caption: string;
  ratio: string;
  slideIndices?: number[];
}): Promise<ActionResult<{ igMediaId: string; mediaRowId: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const renders = await db
    .select()
    .from(contentStudioRenders)
    .where(eq(contentStudioRenders.post_id, input.postId))
    .all();

  const matchingRenders = renders.filter(
    (r) =>
      r.aspect_ratio === input.ratio &&
      r.render_status === "rendered" &&
      r.cloudinary_url,
  );

  if (matchingRenders.length === 0) {
    return {
      ok: false,
      error: `No rendered images found for ratio ${input.ratio}. Render the post first.`,
    };
  }

  const sorted = matchingRenders.sort(
    (a, b) => (a.slide_index ?? 0) - (b.slide_index ?? 0),
  );

  let selectedRenders = sorted;
  if (input.slideIndices && input.slideIndices.length > 0) {
    selectedRenders = sorted.filter((r) =>
      input.slideIndices!.includes(r.slide_index ?? 0),
    );
  }

  if (selectedRenders.length === 0) {
    return { ok: false, error: "No renders match the selected slides." };
  }

  const imageUrls = selectedRenders.map((r) => r.cloudinary_url!);

  let result;
  if (imageUrls.length === 1) {
    result = await publishSingleImage(input.accountId, imageUrls[0], input.caption, {
      sourcePostId: input.postId,
    });
  } else {
    result = await publishCarousel(input.accountId, imageUrls, input.caption, {
      sourcePostId: input.postId,
    });
  }

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/content/studio");

  return {
    ok: true,
    value: { igMediaId: result.igMediaId, mediaRowId: result.mediaRowId },
  };
}
