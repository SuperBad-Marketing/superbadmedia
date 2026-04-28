import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  business_profile_sections,
  BUSINESS_PROFILE_SECTION_KEYS,
  type BusinessProfileSectionKey,
} from "@/lib/db/schema/business-profile-sections";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";

const SNAPSHOT_PATH = join(process.cwd(), "docs", "superbad-profile-snapshot.md");

function sectionLabel(key: BusinessProfileSectionKey): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStructured(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (Array.isArray(v)) {
      const hasObjects = v.some(item => typeof item === "object" && item !== null);
      if (hasObjects) {
        for (const item of v) {
          if (typeof item === "object" && item !== null) {
            const summary = Object.entries(item as Record<string, unknown>)
              .filter(([, val]) => val !== null && val !== undefined)
              .map(([ik, iv]) => `${ik.replace(/_/g, " ")}: ${String(iv)}`)
              .join(" · ");
            lines.push(`- ${summary}`);
          } else {
            lines.push(`- ${String(item)}`);
          }
        }
      } else {
        lines.push(`- **${label}:** ${v.join(", ")}`);
      }
    } else if (typeof v === "object") {
      lines.push(`- **${label}:** ${JSON.stringify(v)}`);
    } else {
      lines.push(`- **${label}:** ${String(v)}`);
    }
  }
  return lines.join("\n");
}

export async function generateProfileSnapshot(): Promise<string> {
  const sections = await db
    .select()
    .from(business_profile_sections)
    .where(eq(business_profile_sections.is_current, true));

  const sectionMap = new Map(
    sections.map((s) => [s.section_key as BusinessProfileSectionKey, s]),
  );

  const brandDna = await db
    .select({
      prose_portrait: brand_dna_profiles.prose_portrait,
      signal_tags: brand_dna_profiles.signal_tags,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "complete"),
      ),
    )
    .get();

  const parts: string[] = [
    "# SuperBad Profile Snapshot",
    "",
    `> Auto-generated ${new Date().toISOString().split("T")[0]}. Source of truth is the database; this file is a convenience export for Claude Code build sessions.`,
    "",
  ];

  if (brandDna?.prose_portrait) {
    parts.push("## Brand Personality (from Brand DNA)");
    parts.push("");
    parts.push(brandDna.prose_portrait.slice(0, 1200));
    if (brandDna.signal_tags) {
      try {
        const tags = JSON.parse(brandDna.signal_tags) as Record<string, unknown>;
        parts.push("");
        parts.push(`**Signal tags:** ${Object.keys(tags).slice(0, 12).join(", ")}`);
      } catch {
        // skip
      }
    }
    parts.push("");
  }

  const renderOrder: BusinessProfileSectionKey[] = [
    "identity",
    "services",
    "voice_rules",
    "external_design_rules",
    "internal_design_rules",
    "audience",
    "positioning",
    "current_focus",
    "social_proof",
    "origin_story",
  ];

  for (const key of renderOrder) {
    const section = sectionMap.get(key);
    if (!section) continue;

    parts.push(`## ${sectionLabel(key)}`);
    parts.push("");

    if (section.prose_summary) {
      parts.push(section.prose_summary);
      parts.push("");
    }

    const structured = formatStructured(section.structured_data);
    if (structured) {
      parts.push(structured);
      parts.push("");
    }
  }

  const emptySections = BUSINESS_PROFILE_SECTION_KEYS.filter(
    (k) => !sectionMap.has(k),
  );
  if (emptySections.length > 0) {
    parts.push("## Sections Not Yet Populated");
    parts.push("");
    for (const key of emptySections) {
      parts.push(`- ${sectionLabel(key)}`);
    }
    parts.push("");
  }

  parts.push("## Dev-Time Skill References");
  parts.push("");
  parts.push("Load the relevant skills before starting work on these task types:");
  parts.push("");
  parts.push("| Task type | Skills to load |");
  parts.push("|---|---|");
  parts.push("| UI / frontend build | `distinctive-frontend`, `design-motion-principles`, `superbad-visual-identity` |");
  parts.push("| Copywriting / email drafts / client-facing text | `persuasive-copywriting`, `superbad-brand-voice` |");
  parts.push("| Visual design / Canva / social graphics | `superbad-visual-identity`, `superbad-brand-voice` |");
  parts.push("| Outreach / lead gen | `superbad-outreach-strategy`, `persuasive-copywriting`, `superbad-brand-voice` |");
  parts.push("| Architecture / planning | `brainstorming`, `writing-plans`, `spec-driven-development` |");
  parts.push("| Debugging | `systematic-debugging` |");
  parts.push("| Business context questions | `superbad-business-context` |");
  parts.push("");

  const content = parts.join("\n");
  await writeFile(SNAPSHOT_PATH, content, "utf-8");
  return content;
}
