"use server";

import { auth } from "@/lib/auth/session";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import {
  productions,
  productionChatMessages,
  PRODUCTION_STATUSES,
  type ProductionRow,
  type ProductionChatMessageRow,
} from "@/lib/db/schema/productions";
import { invokeLlmText } from "@/lib/ai/invoke";

function newId() {
  return crypto.randomUUID();
}

function nowMs() {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  initialThought: z.string().max(2000).optional(),
  subjectName: z.string().max(200).optional(),
  subjectType: z.string().max(100).optional(),
});

const updateProductionSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  subjectName: z.string().max(200).optional().nullable(),
  subjectType: z.string().max(100).optional().nullable(),
  initialThought: z.string().max(2000).optional().nullable(),
  narrativeAngle: z.string().max(2000).optional().nullable(),
  keyMoments: z.array(z.string()).optional().nullable(),
  voiceoverHook: z.string().max(500).optional().nullable(),
  shotList: z.array(z.string()).optional().nullable(),
  gearNotes: z.string().max(2000).optional().nullable(),
  releaseChecklist: z
    .array(z.object({ label: z.string(), done: z.boolean() }))
    .optional()
    .nullable(),
  clips: z
    .array(z.object({ title: z.string(), description: z.string().optional(), status: z.string().optional() }))
    .optional()
    .nullable(),
  shootDate: z.string().optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  companyId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  publishedUrl: z.string().optional().nullable(),
  thumbnailUrl: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProductionsAction(): Promise<ProductionRow[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return db
    .select()
    .from(productions)
    .orderBy(desc(productions.created_at_ms));
}

// ---------------------------------------------------------------------------
// Get single with chat
// ---------------------------------------------------------------------------

export type ProductionWithChat = ProductionRow & {
  chatMessages: ProductionChatMessageRow[];
};

export async function getProductionAction(
  id: string,
): Promise<ProductionWithChat | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const [row] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id))
    .limit(1);
  if (!row) return null;

  const chatMessages = await db
    .select()
    .from(productionChatMessages)
    .where(eq(productionChatMessages.production_id, id))
    .orderBy(productionChatMessages.created_at_ms);

  return { ...row, chatMessages };
}

// ---------------------------------------------------------------------------
// Create idea (+ fire angle generation)
// ---------------------------------------------------------------------------

export async function createIdeaAction(
  input: z.infer<typeof createIdeaSchema>,
): Promise<ProductionRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const parsed = createIdeaSchema.parse(input);
  const id = newId();
  const now = nowMs();

  const row: typeof productions.$inferInsert = {
    id,
    title: parsed.title,
    subject_name: parsed.subjectName ?? null,
    subject_type: parsed.subjectType ?? null,
    initial_thought: parsed.initialThought ?? null,
    status: "idea",
    created_at_ms: now,
    updated_at_ms: now,
  };

  await db.insert(productions).values(row);

  generateAnglesInBackground(id, parsed).catch(() => {});

  revalidatePath("/lite/admin/productions");
  const [created] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id));
  return created;
}

async function generateAnglesInBackground(
  productionId: string,
  input: { title: string; initialThought?: string; subjectName?: string; subjectType?: string },
) {
  const parts: string[] = [`Subject: ${input.title}`];
  if (input.subjectName) parts.push(`Business/person: ${input.subjectName}`);
  if (input.subjectType) parts.push(`Type: ${input.subjectType}`);
  parts.push("");
  parts.push(
    `Andy's initial thought: ${input.initialThought || "(none — just the name for now)"}`,
  );
  parts.push("");
  parts.push(
    "Generate 3–4 distinct episode angles. For each angle, provide:",
  );
  parts.push("- **Angle**: A one-line hook (the thing that makes someone click)");
  parts.push("- **The story**: 2–3 sentences on what the episode actually follows");
  parts.push("- **The moment to hunt for**: The specific scene or beat that could make the episode");
  parts.push('- **Voiceover hook**: A single dry, observational line that could open or close the episode');
  parts.push("");
  parts.push("Return ONLY a JSON array of objects with keys: angle, story, momentToHunt, voiceoverHook");

  const raw = await invokeLlmText({
    job: "productions-angle-gen",
    prompt: parts.join("\n"),
    system: [
      "You are a documentary filmmaker's creative partner. You help brainstorm",
      "episode angles for a solo-shot observational docuseries about real businesses",
      "and the people behind them.",
      "",
      "The format: 15–20 minute episodes, one business per episode, shot by a single",
      "person with one camera (handheld + locked-off tripod). No crew. The tone is",
      "observational, not presentational — patient camera work, real moments, dry",
      "narration. Think Chef's Table meets Bourdain, scaled to one operator.",
      "",
      "The best angles find the story in the gaps — not the obvious pitch, but the",
      "human texture underneath. What makes this business/person worth 15 minutes of",
      "someone's attention?",
    ].join("\n"),
    maxTokens: 2048,
  });

  let angles: unknown;
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      angles = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return;
  }

  if (Array.isArray(angles) && angles.length > 0) {
    await db
      .update(productions)
      .set({
        generated_angles_json: angles,
        updated_at_ms: Date.now(),
      })
      .where(eq(productions.id, productionId));
  }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateProductionAction(
  input: z.infer<typeof updateProductionSchema>,
): Promise<ProductionRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const parsed = updateProductionSchema.parse(input);
  const { id, ...fields } = parsed;

  const set: Record<string, unknown> = { updated_at_ms: nowMs() };
  if (fields.title !== undefined) set.title = fields.title;
  if (fields.subjectName !== undefined) set.subject_name = fields.subjectName;
  if (fields.subjectType !== undefined) set.subject_type = fields.subjectType;
  if (fields.initialThought !== undefined) set.initial_thought = fields.initialThought;
  if (fields.narrativeAngle !== undefined) set.narrative_angle = fields.narrativeAngle;
  if (fields.keyMoments !== undefined)
    set.key_moments_json = fields.keyMoments ? JSON.stringify(fields.keyMoments) : null;
  if (fields.voiceoverHook !== undefined) set.voiceover_hook = fields.voiceoverHook;
  if (fields.shotList !== undefined)
    set.shot_list_json = fields.shotList ? JSON.stringify(fields.shotList) : null;
  if (fields.gearNotes !== undefined) set.gear_notes = fields.gearNotes;
  if (fields.releaseChecklist !== undefined)
    set.release_checklist_json = fields.releaseChecklist
      ? JSON.stringify(fields.releaseChecklist)
      : null;
  if (fields.clips !== undefined)
    set.clips_json = fields.clips ? JSON.stringify(fields.clips) : null;
  if (fields.shootDate !== undefined) set.shoot_date = fields.shootDate;
  if (fields.location !== undefined) set.location = fields.location;
  if (fields.companyId !== undefined) set.company_id = fields.companyId;
  if (fields.contactId !== undefined) set.contact_id = fields.contactId;
  if (fields.publishedUrl !== undefined) set.published_url = fields.publishedUrl;
  if (fields.thumbnailUrl !== undefined) set.thumbnail_url = fields.thumbnailUrl;

  await db.update(productions).set(set).where(eq(productions.id, id));
  revalidatePath("/lite/admin/productions");
  const [updated] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id));
  return updated;
}

// ---------------------------------------------------------------------------
// Promote idea → pipeline
// ---------------------------------------------------------------------------

export async function promoteToProductionAction(
  id: string,
  shootDate?: string,
  location?: string,
): Promise<ProductionRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const now = nowMs();
  await db
    .update(productions)
    .set({
      status: "scheduled",
      shoot_date: shootDate ?? null,
      location: location ?? null,
      promoted_at_ms: now,
      updated_at_ms: now,
    })
    .where(eq(productions.id, id));
  revalidatePath("/lite/admin/productions");
  const [row] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id));
  return row;
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function updateStatusAction(
  id: string,
  status: (typeof PRODUCTION_STATUSES)[number],
): Promise<ProductionRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const now = nowMs();
  const set: Record<string, unknown> = { status, updated_at_ms: now };
  if (status === "published") {
    set.published_at_ms = now;
  }
  await db.update(productions).set(set).where(eq(productions.id, id));
  revalidatePath("/lite/admin/productions");
  const [row] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id));
  return row;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteProductionAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  await db.delete(productions).where(eq(productions.id, id));
  revalidatePath("/lite/admin/productions");
}

// ---------------------------------------------------------------------------
// Chat — add message
// ---------------------------------------------------------------------------

export async function addChatMessageAction(
  productionId: string,
  content: string,
): Promise<ProductionChatMessageRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const id = newId();
  const now = nowMs();
  await db.insert(productionChatMessages).values({
    id,
    production_id: productionId,
    role: "user",
    content,
    created_at_ms: now,
  });
  const [msg] = await db
    .select()
    .from(productionChatMessages)
    .where(eq(productionChatMessages.id, id));
  return msg;
}

export async function saveChatResponseAction(
  productionId: string,
  content: string,
): Promise<ProductionChatMessageRow> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const id = newId();
  const now = nowMs();
  await db.insert(productionChatMessages).values({
    id,
    production_id: productionId,
    role: "assistant",
    content,
    created_at_ms: now,
  });
  const [msg] = await db
    .select()
    .from(productionChatMessages)
    .where(eq(productionChatMessages.id, id));
  return msg;
}

// ---------------------------------------------------------------------------
// Regenerate angles
// ---------------------------------------------------------------------------

export async function regenerateAnglesAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const [row] = await db
    .select()
    .from(productions)
    .where(eq(productions.id, id));
  if (!row) throw new Error("Production not found");
  await generateAnglesInBackground(id, {
    title: row.title,
    initialThought: row.initial_thought ?? undefined,
    subjectName: row.subject_name ?? undefined,
    subjectType: row.subject_type ?? undefined,
  });
  revalidatePath("/lite/admin/productions");
}
