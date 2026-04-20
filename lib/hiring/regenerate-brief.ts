import { invokeLlmText } from "@/lib/ai/invoke";
import {
  getRoleBriefById,
  updateRoleBrief,
  listCandidates,
  getArchivesForCandidate,
} from "./queries";
import { logActivity } from "@/lib/activity-log";
import type { RoleBriefRow } from "@/lib/db/schema/role-briefs";
import type { CandidateArchiveRow } from "@/lib/db/schema/candidate-archives";

export interface RegenerateBriefResult {
  ok: boolean;
  briefId: string;
  reason?: string;
}

export async function regenerateRoleBrief(
  roleBriefId: string,
  trigger: "bench_entry" | "archive_reflection" | "archive_threshold" | "manual_retune",
): Promise<RegenerateBriefResult> {
  const brief = await getRoleBriefById(roleBriefId);
  if (!brief) {
    return { ok: false, briefId: roleBriefId, reason: "Role Brief not found." };
  }

  if (brief.status !== "open" && brief.status !== "paused") {
    return {
      ok: false,
      briefId: roleBriefId,
      reason: `Role Brief status is '${brief.status}' — skipping regen.`,
    };
  }

  const allCandidates = await listCandidates({ role_brief_id: roleBriefId });

  const benchMembers = allCandidates.filter((c) => c.stage === "bench");
  const archivedCandidates = allCandidates.filter(
    (c) => c.stage === "archived",
  );

  const allArchives: CandidateArchiveRow[] = [];
  for (const c of archivedCandidates) {
    const archives = await getArchivesForCandidate(c.id);
    allArchives.push(...archives.filter((a) => a.reflection_text));
  }

  const currentDoList: string[] = Array.isArray(brief.style_do_list_json)
    ? (brief.style_do_list_json as string[])
    : [];
  const currentAvoidList: string[] = Array.isArray(brief.style_avoid_list_json)
    ? (brief.style_avoid_list_json as string[])
    : [];
  const currentTags: string[] = Array.isArray(brief.extracted_tags_json)
    ? (brief.extracted_tags_json as string[])
    : [];
  const currentHints: string[] = Array.isArray(
    brief.discovery_search_hints_json,
  )
    ? (brief.discovery_search_hints_json as string[])
    : [];

  const referenceSignals = Array.isArray(brief.reference_signals_json)
    ? (brief.reference_signals_json as Array<Record<string, unknown>>)
    : [];

  const prompt = buildRegenPrompt(
    brief,
    referenceSignals,
    benchMembers.length,
    allArchives,
    currentDoList,
    currentAvoidList,
    currentTags,
    currentHints,
  );

  try {
    const raw = await invokeLlmText({
      job: "hiring-brief-synthesize",
      prompt,
      maxTokens: 1500,
    });

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        ok: false,
        briefId: roleBriefId,
        reason: "Regen returned unexpected format.",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      style_summary?: string;
      extracted_tags?: string[];
      style_do_list?: string[];
      style_avoid_list?: string[];
      discovery_search_hints?: string[];
    };

    await updateRoleBrief(roleBriefId, {
      style_summary: parsed.style_summary ?? brief.style_summary,
      extracted_tags_json: Array.isArray(parsed.extracted_tags)
        ? parsed.extracted_tags
        : currentTags,
      style_do_list_json: Array.isArray(parsed.style_do_list)
        ? parsed.style_do_list
        : currentDoList,
      style_avoid_list_json: Array.isArray(parsed.style_avoid_list)
        ? parsed.style_avoid_list
        : currentAvoidList,
      discovery_search_hints_json: Array.isArray(parsed.discovery_search_hints)
        ? parsed.discovery_search_hints
        : currentHints,
      last_regenerated_at_ms: Date.now(),
    });

    await logActivity({
      kind: "role_brief_regenerated",
      body: `Role Brief "${brief.role_name}" regenerated (trigger: ${trigger}).`,
      meta: {
        role_brief_id: roleBriefId,
        trigger,
        bench_count: benchMembers.length,
        archive_reflections_count: allArchives.length,
      },
    });

    return { ok: true, briefId: roleBriefId };
  } catch (err) {
    return {
      ok: false,
      briefId: roleBriefId,
      reason: err instanceof Error ? err.message : "Regen LLM call failed.",
    };
  }
}

function buildRegenPrompt(
  brief: RoleBriefRow,
  referenceSignals: Array<Record<string, unknown>>,
  benchCount: number,
  archiveReflections: CandidateArchiveRow[],
  currentDoList: string[],
  currentAvoidList: string[],
  currentTags: string[],
  currentHints: string[],
): string {
  const signalsSummary =
    referenceSignals.length > 0
      ? referenceSignals
          .map(
            (s) =>
              `URL: ${s.url ?? "unknown"} | Platform: ${s.platform ?? "unknown"} | Tags: ${Array.isArray(s.extracted_tags) ? (s.extracted_tags as string[]).join(", ") : "none"} | Samples: ${Array.isArray(s.work_samples) ? (s.work_samples as unknown[]).length : 0}`,
          )
          .join("\n")
      : "No original reference signals available.";

  const reflectionsSummary =
    archiveReflections.length > 0
      ? archiveReflections
          .slice(-20)
          .map(
            (a) =>
              `Reason: ${a.reason_code}${a.reason_free_text ? ` — ${a.reason_free_text}` : ""}. Reflection: "${a.reflection_text}"`,
          )
          .join("\n")
      : "No archive reflections yet.";

  const rateRange =
    brief.rate_min_aud != null && brief.rate_max_aud != null
      ? `$${brief.rate_min_aud}–$${brief.rate_max_aud}/hr`
      : brief.rate_min_aud != null
        ? `from $${brief.rate_min_aud}/hr`
        : "not specified";

  return `You are regenerating a Role Brief for a creative contractor hiring pipeline. This brief is perpetual LLM context — every downstream hiring action reads it.

Role: ${brief.role_name}
Type: ${brief.engagement_type}
Rate band: ${rateRange}
Hours/week: ${brief.target_hours_per_week ?? "flexible"}
Location: ${brief.location_pref_city ?? "any"}${brief.remote_ok ? " (remote OK)" : " (on-site only)"}
Slots to fill: ${brief.open_count}
Currently on bench: ${benchCount}

${brief.andy_overrides ? `Andy's manual overrides (always respect these):\n${brief.andy_overrides}\n` : ""}
Current style summary: ${brief.style_summary ?? "none yet"}
Current do list: ${currentDoList.length > 0 ? currentDoList.join("; ") : "empty"}
Current avoid list: ${currentAvoidList.length > 0 ? currentAvoidList.join("; ") : "empty"}
Current tags: ${currentTags.length > 0 ? currentTags.join(", ") : "empty"}
Current discovery hints: ${currentHints.length > 0 ? currentHints.join("; ") : "empty"}

Original reference portfolios:
${signalsSummary}

Archive reflections (negative signal — these shaped the avoid list):
${reflectionsSummary}

Regenerate the brief incorporating all accumulated signal. The avoid list should KEEP all existing items unless a reflection explicitly contradicts one. Bench entries are positive signal — the current bench validates existing "do" criteria.

Return ONLY valid JSON:
{
  "style_summary": "2-3 sentence updated prose description",
  "extracted_tags": ["updated", "tag", "array"],
  "style_do_list": ["refined criteria the ideal candidate demonstrates"],
  "style_avoid_list": ["all existing + any new items from reflections"],
  "discovery_search_hints": ["updated search queries for scouting"]
}

Be specific to the accumulated signal, not generic.`;
}
