import { db } from "@/lib/db";
import {
  talkingHeadSessionPacks,
  talkingHeadScripts,
  pillarBySlug,
  type ScriptRow,
  type SessionPackRow,
} from "@/lib/db/schema/talking-head";
import { eq } from "drizzle-orm";
import {
  generateScript,
  generateEditBrief,
  generatePublishMeta,
} from "@/lib/talking-head/generate-script";
import type { PillarSlug, ScriptFormat } from "@/lib/db/schema/talking-head";

export interface ScriptIdeaInput {
  topic: string;
  pillar: PillarSlug;
  format: ScriptFormat;
  angle: string;
}

function ulid(): string {
  const t = Date.now().toString(36).padStart(10, "0");
  const r = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
  return (t + r).toUpperCase();
}

export interface CommittedScriptPack {
  packId: string;
  scripts: Array<{ id: string; title: string; pillar: string; format: string }>;
}

export async function commitScriptIdeas(
  ideas: ScriptIdeaInput[],
  braindumpId: string,
): Promise<CommittedScriptPack> {
  const now = Date.now();
  const packId = ulid();

  await db.insert(talkingHeadSessionPacks).values({
    id: packId,
    status: "draft",
    energy_level: "default",
    script_count: ideas.length,
    source_braindump_id: braindumpId,
    created_at_ms: now,
    updated_at_ms: now,
  });

  const committedScripts: CommittedScriptPack["scripts"] = [];

  for (let i = 0; i < ideas.length; i++) {
    const idea = ideas[i];
    const pillar = pillarBySlug(idea.pillar);

    const generated = await generateScript(pillar, idea.format, "default");
    const editBrief = await generateEditBrief(generated);
    const publishMeta = await generatePublishMeta(generated, editBrief);

    const scriptId = ulid();

    await db.insert(talkingHeadScripts).values({
      id: scriptId,
      session_pack_id: packId,
      pillar_slug: idea.pillar,
      format: idea.format,
      status: "generated",
      title: generated.title,
      hook: generated.hook,
      estimated_duration_sec: generated.estimated_duration_sec,
      script_json: generated as unknown as Record<string, unknown>,
      edit_brief_json: editBrief as unknown as Record<string, unknown>,
      publish_meta_json: publishMeta as unknown as Record<string, unknown>,
      energy_level: "default",
      signal_source: `braindump:${braindumpId}`,
      source_braindump_id: braindumpId,
      sort_order: i,
      created_at_ms: now,
      updated_at_ms: now,
    });

    committedScripts.push({
      id: scriptId,
      title: generated.title,
      pillar: idea.pillar,
      format: idea.format,
    });
  }

  await db
    .update(talkingHeadSessionPacks)
    .set({ status: "ready", updated_at_ms: Date.now() })
    .where(eq(talkingHeadSessionPacks.id, packId));

  return { packId, scripts: committedScripts };
}
