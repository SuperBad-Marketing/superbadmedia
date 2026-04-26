"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  instagram_accounts,
  instagram_content_plans,
  type ContentPlanSlot,
} from "@/lib/db/schema/instagram";
import { tasks } from "@/lib/db/schema/tasks";
import { user } from "@/lib/db/schema/user";
import { logActivity } from "@/lib/activity-log";
import { contentStudioRenders } from "@/lib/db/schema/content-studio";
import { publishSingleImage, publishCarousel } from "@/lib/channels/instagram/publish";
import { invokeLlmText } from "@/lib/ai/invoke";
import { getCredential } from "@/lib/integrations/getCredential";
import { getPages, getInstagramAccountFromPage, getAccountInfo } from "@/lib/channels/instagram/client";

type ActionResult<T = unknown> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export async function retryInstagramDiscoveryAction(): Promise<
  ActionResult<{ username: string }>
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const raw = await getCredential("meta");
  if (!raw) {
    return {
      ok: false,
      error: "Meta isn't connected yet. Set it up in Settings → Integrations first.",
    };
  }

  let accessToken: string;
  try {
    const creds = JSON.parse(raw) as { accessToken?: string };
    accessToken = creds.accessToken ?? raw;
  } catch {
    accessToken = raw;
  }

  const pagesResult = await getPages(accessToken);
  if (!pagesResult.ok) {
    return {
      ok: false,
      error: `Could not list Facebook Pages: ${pagesResult.error}. Check that the Meta app has pages_show_list permission.`,
    };
  }
  if (pagesResult.data.data.length === 0) {
    return {
      ok: false,
      error: "No Facebook Pages found. Your Instagram Business account needs a linked Facebook Page.",
    };
  }

  for (const page of pagesResult.data.data) {
    const igResult = await getInstagramAccountFromPage(page.id, accessToken);
    if (!igResult.ok) continue;
    const igBizAccount = igResult.data?.instagram_business_account;
    if (!igBizAccount?.id) continue;

    const infoResult = await getAccountInfo(igBizAccount.id, page.access_token);
    if (!infoResult.ok) continue;

    const existing = await db.query.instagram_accounts.findFirst({
      where: (t, { eq: e }) => e(t.instagram_user_id, igBizAccount.id),
    });

    if (existing) {
      await db
        .update(instagram_accounts)
        .set({
          access_token: page.access_token,
          token_expires_at_ms: Date.now() + 60 * 86400 * 1000,
          status: "active",
        })
        .where(eq(instagram_accounts.id, existing.id));
    } else {
      await db.insert(instagram_accounts).values({
        id: randomUUID(),
        instagram_user_id: igBizAccount.id,
        username: infoResult.data.username,
        account_type: "own",
        access_token: page.access_token,
        token_expires_at_ms: Date.now() + 60 * 86400 * 1000,
        connected_at_ms: Date.now(),
        status: "active",
      });
    }

    revalidatePath("/lite/content/instagram");
    return { ok: true, value: { username: infoResult.data.username } };
  }

  return {
    ok: false,
    error: "No Instagram Business Account found on your Facebook Pages. Link one in Meta Business Suite first.",
  };
}

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

export async function approvePlanSlotsAction(input: {
  planId: string;
  slotIndices: number[];
}): Promise<ActionResult<{ tasksCreated: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const plan = await db
    .select()
    .from(instagram_content_plans)
    .where(eq(instagram_content_plans.id, input.planId))
    .get();

  if (!plan) return { ok: false, error: "Plan not found." };

  const account = await db
    .select()
    .from(instagram_accounts)
    .where(eq(instagram_accounts.id, plan.account_id))
    .get();

  if (!account) return { ok: false, error: "Instagram account not found." };

  const adminUser = await db
    .select({ id: user.id })
    .from(user)
    .limit(1)
    .get();
  const createdBy = adminUser?.id ?? "admin-dev-01";

  const slots = [...(plan.slots_json as ContentPlanSlot[])];
  const now = Date.now();
  let tasksCreated = 0;

  for (const idx of input.slotIndices) {
    const slot = slots[idx];
    if (!slot || slot.approved) continue;

    const taskId = randomUUID();
    const taskKind = account.account_type === "own" ? "admin" : "client_task";
    const dueMs = new Date(slot.suggested_date + "T10:00:00+10:00").getTime();

    await db.insert(tasks).values({
      id: taskId,
      title: `Instagram: ${slot.topic}`,
      body: `${slot.caption_direction}\n\nContent type: ${slot.content_type}\nAccount: @${account.username}`,
      kind: taskKind as "admin" | "client_task",
      status: "todo",
      priority: "normal",
      due_at_ms: dueMs,
      entity_type: account.company_id ? "company" : null,
      entity_id: account.company_id ?? null,
      created_at_ms: now,
      updated_at_ms: now,
      created_by: createdBy,
    });

    slots[idx] = { ...slot, approved: true, task_id: taskId };
    tasksCreated++;
  }

  const allApproved = slots.every((s) => s.approved);
  const anyApproved = slots.some((s) => s.approved);

  await db
    .update(instagram_content_plans)
    .set({
      slots_json: slots,
      status: allApproved
        ? "all_approved"
        : anyApproved
          ? "partially_approved"
          : "awaiting_review",
      reviewed_at_ms: plan.reviewed_at_ms ?? now,
      updated_at_ms: now,
    })
    .where(eq(instagram_content_plans.id, plan.id));

  await logActivity({
    kind: "instagram_plan_approved",
    companyId: account.company_id ?? undefined,
    body: `${tasksCreated} Instagram post${tasksCreated !== 1 ? "s" : ""} approved for @${account.username}.`,
    meta: {
      plan_id: plan.id,
      account_id: account.id,
      tasks_created: tasksCreated,
      slot_indices: input.slotIndices,
    },
  });

  revalidatePath("/lite/content/instagram");
  revalidatePath("/lite/tasks");
  return { ok: true, value: { tasksCreated } };
}

export async function updatePlanSlotAction(input: {
  planId: string;
  slotIndex: number;
  topic?: string;
  captionDirection?: string;
}): Promise<ActionResult<void>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin")
    return { ok: false, error: "Not authorised." };

  const plan = await db
    .select()
    .from(instagram_content_plans)
    .where(eq(instagram_content_plans.id, input.planId))
    .get();

  if (!plan) return { ok: false, error: "Plan not found." };

  const slots = [...(plan.slots_json as ContentPlanSlot[])];
  const slot = slots[input.slotIndex];
  if (!slot) return { ok: false, error: "Slot not found." };
  if (slot.approved) return { ok: false, error: "Slot already approved." };

  if (input.topic !== undefined) slot.topic = input.topic;
  if (input.captionDirection !== undefined)
    slot.caption_direction = input.captionDirection;
  slots[input.slotIndex] = slot;

  await db
    .update(instagram_content_plans)
    .set({ slots_json: slots, updated_at_ms: Date.now() })
    .where(eq(instagram_content_plans.id, plan.id));

  revalidatePath("/lite/content/instagram");
  return { ok: true, value: undefined };
}
