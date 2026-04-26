import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  talkingHeadSessionPacks,
  talkingHeadScripts,
  PILLARS,
  type EnergyLevel,
  type ScriptFormat,
  type PillarSlug,
  type SessionPackRow,
  type ScriptRow,
  pillarBySlug,
} from "@/lib/db/schema/talking-head";
import {
  generateScript,
  generateEditBrief,
  generatePublishMeta,
} from "./generate-script";

function ulid(): string {
  const t = Date.now().toString(36).padStart(10, "0");
  const r = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join("");
  return (t + r).toUpperCase();
}

function pickPillarMix(count: number): PillarSlug[] {
  const pool = [...PILLARS];
  const picked: PillarSlug[] = [];

  // Always start with something easy (overheard or shooting_small_business)
  const openers: PillarSlug[] = ["overheard_in_marketing", "shooting_small_business"];
  const opener = openers[Math.floor(Math.random() * openers.length)];
  picked.push(opener);

  const remaining = pool.filter((p) => p.slug !== opener);

  // Fill remaining slots, avoiding consecutive authority-only pillars
  while (picked.length < count && remaining.length > 0) {
    const idx = Math.floor(Math.random() * remaining.length);
    picked.push(remaining[idx].slug);
    remaining.splice(idx, 1);
  }

  return picked;
}

function pickFormatMix(count: number): ScriptFormat[] {
  // At least one of each, rest random with bias toward short
  const formats: ScriptFormat[] = [];
  if (count >= 2) {
    formats.push("short", "mid");
    for (let i = 2; i < count; i++) {
      formats.push(Math.random() < 0.6 ? "short" : "mid");
    }
  } else {
    formats.push("short");
  }
  // Shuffle
  for (let i = formats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [formats[i], formats[j]] = [formats[j], formats[i]];
  }
  return formats;
}

export async function createSessionPack(
  energy: EnergyLevel = "default",
  scriptCount = 4,
): Promise<{ pack: SessionPackRow; scripts: ScriptRow[] }> {
  const now = Date.now();
  const packId = ulid();

  await db.insert(talkingHeadSessionPacks).values({
    id: packId,
    status: "draft",
    energy_level: energy,
    script_count: scriptCount,
    created_at_ms: now,
    updated_at_ms: now,
  });

  const pillarSlugs = pickPillarMix(scriptCount);
  const formats = pickFormatMix(scriptCount);
  const scripts: ScriptRow[] = [];

  for (let i = 0; i < scriptCount; i++) {
    const pillar = pillarBySlug(pillarSlugs[i]);
    const format = formats[i];

    const generated = await generateScript(pillar, format, energy);
    const editBrief = await generateEditBrief(generated);
    const publishMeta = await generatePublishMeta(generated, editBrief);

    const scriptId = ulid();
    const scriptRow: ScriptRow = {
      id: scriptId,
      session_pack_id: packId,
      pillar_slug: pillarSlugs[i],
      format,
      status: "generated",
      title: generated.title,
      hook: generated.hook,
      estimated_duration_sec: generated.estimated_duration_sec,
      script_json: generated as unknown as Record<string, unknown>,
      edit_brief_json: editBrief as unknown as Record<string, unknown>,
      publish_meta_json: publishMeta as unknown as Record<string, unknown>,
      energy_level: energy,
      signal_source: null,
      source_braindump_id: null,
      sort_order: i,
      created_at_ms: now,
      updated_at_ms: now,
    };

    await db.insert(talkingHeadScripts).values(scriptRow);
    scripts.push(scriptRow);
  }

  await db
    .update(talkingHeadSessionPacks)
    .set({ status: "ready", updated_at_ms: Date.now() })
    .where(eq(talkingHeadSessionPacks.id, packId));

  const pack = await db
    .select()
    .from(talkingHeadSessionPacks)
    .where(eq(talkingHeadSessionPacks.id, packId))
    .then((rows) => rows[0]!);

  return { pack, scripts };
}

export async function getCurrentPack(): Promise<{
  pack: SessionPackRow | null;
  scripts: ScriptRow[];
}> {
  const pack = await db
    .select()
    .from(talkingHeadSessionPacks)
    .orderBy(desc(talkingHeadSessionPacks.created_at_ms))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!pack) return { pack: null, scripts: [] };

  const scripts = await db
    .select()
    .from(talkingHeadScripts)
    .where(eq(talkingHeadScripts.session_pack_id, pack.id))
    .orderBy(talkingHeadScripts.sort_order);

  return { pack, scripts };
}

export async function updateScriptStatus(
  scriptId: string,
  status: "approved" | "skipped" | "filmed",
): Promise<void> {
  await db
    .update(talkingHeadScripts)
    .set({ status, updated_at_ms: Date.now() })
    .where(eq(talkingHeadScripts.id, scriptId));
}

export async function updatePackEnergy(
  packId: string,
  energy: EnergyLevel,
): Promise<void> {
  await db
    .update(talkingHeadSessionPacks)
    .set({ energy_level: energy, updated_at_ms: Date.now() })
    .where(eq(talkingHeadSessionPacks.id, packId));
}

export async function getPackHistory(): Promise<SessionPackRow[]> {
  return db
    .select()
    .from(talkingHeadSessionPacks)
    .orderBy(desc(talkingHeadSessionPacks.created_at_ms))
    .limit(20);
}
