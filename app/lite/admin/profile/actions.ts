"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  business_profile_sections,
  BUSINESS_PROFILE_SECTION_KEYS,
  type BusinessProfileSectionKey,
} from "@/lib/db/schema/business-profile-sections";
import {
  business_profile_suggestions,
} from "@/lib/db/schema/business-profile-suggestions";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { logActivity } from "@/lib/activity-log";
import { invalidateProfileCache } from "@/lib/business-profile/load-context";
import { generateProfileSnapshot } from "@/lib/business-profile/generate-snapshot";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  return session.user.id ?? "admin";
}

export async function loadProfileSections() {
  const userId = await requireAdmin();
  if (!userId) return { sections: [], brandDna: null };

  const sections = await db
    .select()
    .from(business_profile_sections)
    .where(eq(business_profile_sections.is_current, true))
    .orderBy(business_profile_sections.section_key);

  const brandDna = await db
    .select({
      id: brand_dna_profiles.id,
      prose_portrait: brand_dna_profiles.prose_portrait,
      signal_tags: brand_dna_profiles.signal_tags,
      status: brand_dna_profiles.status,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .get();

  return { sections, brandDna: brandDna ?? null };
}

export async function loadPendingSuggestions() {
  const userId = await requireAdmin();
  if (!userId) return [];

  return db
    .select()
    .from(business_profile_suggestions)
    .where(eq(business_profile_suggestions.status, "pending"))
    .orderBy(desc(business_profile_suggestions.created_at_ms));
}

export async function saveSectionAction(
  sectionKey: string,
  structuredData: Record<string, unknown>,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  if (
    !BUSINESS_PROFILE_SECTION_KEYS.includes(
      sectionKey as BusinessProfileSectionKey,
    )
  ) {
    return { ok: false, error: "Unknown section." };
  }

  const now = Date.now();

  const existing = await db
    .select()
    .from(business_profile_sections)
    .where(
      and(
        eq(business_profile_sections.section_key, sectionKey),
        eq(business_profile_sections.is_current, true),
      ),
    )
    .get();

  if (existing) {
    await db
      .update(business_profile_sections)
      .set({ is_current: false })
      .where(eq(business_profile_sections.id, existing.id));

    await db.insert(business_profile_sections).values({
      id: randomUUID(),
      section_key: sectionKey,
      structured_data: structuredData,
      prose_summary: existing.prose_summary,
      prose_generated_at_ms: existing.prose_generated_at_ms,
      prose_manually_edited: existing.prose_manually_edited,
      version: existing.version + 1,
      is_current: true,
      updated_by: "manual",
      updated_at_ms: now,
      created_at_ms: now,
    });

    await logActivity({
      kind: "profile_section_updated",
      body: `Updated profile section: ${sectionKey}`,
      meta: { section_key: sectionKey, version: existing.version + 1 },
      createdBy: `user:${userId}`,
    });
  } else {
    await db.insert(business_profile_sections).values({
      id: randomUUID(),
      section_key: sectionKey,
      structured_data: structuredData,
      prose_summary: null,
      prose_generated_at_ms: null,
      prose_manually_edited: false,
      version: 1,
      is_current: true,
      updated_by: "manual",
      updated_at_ms: now,
      created_at_ms: now,
    });

    await logActivity({
      kind: "profile_section_created",
      body: `Created profile section: ${sectionKey}`,
      meta: { section_key: sectionKey },
      createdBy: `user:${userId}`,
    });
  }

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch {
    // snapshot generation is best-effort
  }

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

export async function saveProseAction(
  sectionKey: string,
  prose: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const existing = await db
    .select()
    .from(business_profile_sections)
    .where(
      and(
        eq(business_profile_sections.section_key, sectionKey),
        eq(business_profile_sections.is_current, true),
      ),
    )
    .get();

  if (!existing) return { ok: false, error: "Section not found." };

  const now = Date.now();

  await db
    .update(business_profile_sections)
    .set({
      prose_summary: prose,
      prose_manually_edited: true,
      updated_at_ms: now,
    })
    .where(eq(business_profile_sections.id, existing.id));

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch {
    // best-effort
  }

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

export async function regenerateProseAction(
  sectionKey: string,
): Promise<ActionResult & { prose?: string }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const existing = await db
    .select()
    .from(business_profile_sections)
    .where(
      and(
        eq(business_profile_sections.section_key, sectionKey),
        eq(business_profile_sections.is_current, true),
      ),
    )
    .get();

  if (!existing) return { ok: false, error: "Section not found." };

  const { invokeLlmText } = await import("@/lib/ai/invoke");
  const label = sectionKey.replace(/_/g, " ");
  const structuredJson = JSON.stringify(existing.structured_data, null, 2);

  const prose = await invokeLlmText({
    job: "profile-generate-prose-summary",
    prompt: `Summarise this "${label}" section of a business profile into 2-3 natural sentences. Write in third person. Be factual, not promotional.\n\n${structuredJson}`,
    maxTokens: 300,
    actorType: "internal",
  });

  const now = Date.now();

  await db
    .update(business_profile_sections)
    .set({
      prose_summary: prose,
      prose_generated_at_ms: now,
      prose_manually_edited: false,
      updated_at_ms: now,
    })
    .where(eq(business_profile_sections.id, existing.id));

  await logActivity({
    kind: "profile_prose_regenerated",
    body: `Regenerated prose for: ${sectionKey}`,
    meta: { section_key: sectionKey },
    createdBy: `user:${userId}`,
  });

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch {
    // best-effort
  }

  revalidatePath("/lite/admin/profile");
  return { ok: true, prose };
}

export async function approveSuggestionAction(
  suggestionId: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const now = Date.now();

  await db
    .update(business_profile_suggestions)
    .set({ status: "approved", resolved_at_ms: now })
    .where(eq(business_profile_suggestions.id, suggestionId));

  await logActivity({
    kind: "profile_suggestion_approved",
    body: `Approved profile suggestion`,
    meta: { suggestion_id: suggestionId },
    createdBy: `user:${userId}`,
  });

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

export async function dismissSuggestionAction(
  suggestionId: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const now = Date.now();

  await db
    .update(business_profile_suggestions)
    .set({ status: "dismissed", resolved_at_ms: now })
    .where(eq(business_profile_suggestions.id, suggestionId));

  await logActivity({
    kind: "profile_suggestion_dismissed",
    body: `Dismissed profile suggestion`,
    meta: { suggestion_id: suggestionId },
    createdBy: `user:${userId}`,
  });

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

export async function loadDraftBrandDna() {
  const userId = await requireAdmin();
  if (!userId) return null;

  return db
    .select({
      id: brand_dna_profiles.id,
      prose_portrait: brand_dna_profiles.prose_portrait,
      first_impression: brand_dna_profiles.first_impression,
      signal_tags: brand_dna_profiles.signal_tags,
      status: brand_dna_profiles.status,
      updated_at_ms: brand_dna_profiles.updated_at_ms,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
        eq(brand_dna_profiles.status, "awaiting_approval"),
      ),
    )
    .get() ?? null;
}

export async function approveBrandDnaAction(
  profileId: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const now = Date.now();

  await db
    .update(brand_dna_profiles)
    .set({
      status: "complete",
      completed_at_ms: now,
      updated_at_ms: now,
    })
    .where(
      and(
        eq(brand_dna_profiles.id, profileId),
        eq(brand_dna_profiles.status, "awaiting_approval"),
      ),
    );

  await logActivity({
    kind: "brand_dna_approved",
    body: "Brand DNA approved — now live across all AI features",
    createdBy: `user:${userId}`,
  });

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch {
    // best-effort
  }

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

export async function discardBrandDnaDraftAction(
  profileId: string,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  await db
    .update(brand_dna_profiles)
    .set({ is_current: false, updated_at_ms: Date.now() })
    .where(
      and(
        eq(brand_dna_profiles.id, profileId),
        eq(brand_dna_profiles.status, "awaiting_approval"),
      ),
    );

  await logActivity({
    kind: "brand_dna_draft_discarded",
    body: "Brand DNA draft discarded — previous version remains active",
    createdBy: `user:${userId}`,
  });

  revalidatePath("/lite/admin/profile");
  return { ok: true };
}

const SECTION_SCHEMAS: Record<string, string> = {
  social_proof: `Array of proof points. Return JSON: { "proof_points": [{ "client_name": string, "client_description": string (one line — what they do), "outcome": string (what was delivered/achieved), "quotable": boolean (whether they've given permission to be referenced), "vertical": string (industry), "added_at_ms": number (use current timestamp) }] }`,
  origin_story: `Return JSON: { "short_version": string (2-3 sentences — the elevator version), "full_version": string (2-3 paragraphs — the real story), "founding_motivation": string (why this business exists), "name_origin": string or null (where the name comes from, if worth telling) }`,
  identity: `Return JSON: { "business_name": string, "legal_name": string, "founder_name": string, "location": string, "structure": "solo_founder"|"founder_led_team"|"multi_stakeholder", "tagline": string, "website_url": string, "contact_email": string }`,
  services: `Array of service offerings. Return JSON: { "services": [{ "name": string, "price_display": string (e.g. "$397 inc GST"), "price_cents": number, "description": string, "is_recurring": boolean, "billing_cadence": string|null ("monthly"/"annual"/null), "active": boolean }] }`,
  audience: `Return JSON: { "primary_description": string, "geography": string, "verticals": string[] (empty if no restriction), "vertical_philosophy": string, "ideal_client_traits": string[], "anti_patterns": string[] }`,
  positioning: `Return JSON: { "one_liner": string, "differentiators": string[], "philosophy": string, "pricing_philosophy": string, "competitors_context": string }`,
  current_focus: `Return JSON: { "current_quarter_focus": string, "seasonal_emphasis": string|null, "growth_priorities": string[], "active_campaigns": string[], "recent_shifts": string }`,
  voice_rules: `Return JSON: { "tone_description": string, "tone_markers": string[], "banned_words": string[], "sentence_style": string, "humour_rules": string, "register_admin": string, "register_client": string, "register_public": string, "exclamation_marks": boolean, "emoji_policy": string }`,
  external_design_rules: `Return JSON with fields: colour_palette (object), colour_ratio, typography_display, typography_labels, typography_editorial, typography_body, typography_logo, dark_over_light (boolean), visual_era, composition_style, photography_style, typography_as_graphic (boolean), production_philosophy, overall_feeling, cultural_references (string[]), social_post_rules, pdf_rules, email_rules`,
  internal_design_rules: `Return JSON with fields: admin_shell, page_chrome, surface_strategy, motion_house_spring, motion_reduced, radius_style, density_default, empty_states, icon_library, form_style, table_style, sound_approach, mobile_approach, no_generic_tailwind, accessibility_baseline`,
};

export async function refineBraindumpAction(
  sectionKey: string,
  rawText: string,
): Promise<ActionResult & { structured?: Record<string, unknown>; prose?: string }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  if (!BUSINESS_PROFILE_SECTION_KEYS.includes(sectionKey as BusinessProfileSectionKey)) {
    return { ok: false, error: "Unknown section." };
  }

  if (!rawText.trim()) {
    return { ok: false, error: "Nothing to refine — type something first." };
  }

  const schema = SECTION_SCHEMAS[sectionKey];
  if (!schema) {
    return { ok: false, error: "No schema defined for this section." };
  }

  const { invokeLlmText } = await import("@/lib/ai/invoke");

  const label = sectionKey.replace(/_/g, " ");
  const structuredResponse = await invokeLlmText({
    job: "profile-refine-braindump",
    prompt: `You are extracting structured business profile data from a braindump. The user typed raw notes about the "${label}" section of their business profile. Extract and organise this into the required JSON structure.

Rules:
- Use ONLY information from the braindump. Do not invent facts.
- Clean up grammar and phrasing but preserve the meaning and tone.
- If a field cannot be filled from the braindump, use null.
- Return ONLY valid JSON, no markdown fences, no explanation.

Required structure:
${schema}

Braindump:
${rawText}`,
    maxTokens: 1500,
    actorType: "internal",
  });

  let parsed: Record<string, unknown>;
  try {
    const cleaned = structuredResponse.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "AI returned invalid JSON. Try again or edit manually." };
  }

  // Save structured data
  const saveResult = await saveSectionAction(sectionKey, parsed);
  if (!saveResult.ok) return saveResult;

  // Generate prose summary
  const prose = await invokeLlmText({
    job: "profile-generate-prose-summary",
    prompt: `Summarise this "${label}" section of a business profile into 2-3 natural sentences. Write in third person. Be factual, not promotional.\n\n${JSON.stringify(parsed, null, 2)}`,
    maxTokens: 300,
    actorType: "internal",
  });

  const now = Date.now();
  const current = await db
    .select()
    .from(business_profile_sections)
    .where(
      and(
        eq(business_profile_sections.section_key, sectionKey),
        eq(business_profile_sections.is_current, true),
      ),
    )
    .get();

  if (current) {
    await db
      .update(business_profile_sections)
      .set({
        prose_summary: prose,
        prose_generated_at_ms: now,
        updated_at_ms: now,
      })
      .where(eq(business_profile_sections.id, current.id));
  }

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch { /* best-effort */ }

  await logActivity({
    kind: "profile_section_updated",
    body: `Refined "${label}" from braindump`,
    meta: { section_key: sectionKey, source: "braindump_refine" },
    createdBy: `user:${userId}`,
  });

  revalidatePath("/lite/admin/profile");
  return { ok: true, structured: parsed, prose };
}

export async function populateProfileAction(): Promise<ActionResult & { sectionsPopulated?: number; sectionsSkipped?: string[] }> {
  const userId = await requireAdmin();
  if (!userId) return { ok: false, error: "Not authorised." };

  const { populateAllSections } = await import("@/lib/business-profile/populate-profile");
  const result = await populateAllSections(userId);
  if (!result.ok) return result;

  revalidatePath("/lite/admin/profile");
  return { ok: true, sectionsPopulated: result.sectionsPopulated, sectionsSkipped: result.sectionsSkipped };
}

export async function loadSectionHistory(sectionKey: string) {
  const userId = await requireAdmin();
  if (!userId) return [];

  return db
    .select({
      id: business_profile_sections.id,
      version: business_profile_sections.version,
      updated_by: business_profile_sections.updated_by,
      updated_at_ms: business_profile_sections.updated_at_ms,
      is_current: business_profile_sections.is_current,
    })
    .from(business_profile_sections)
    .where(eq(business_profile_sections.section_key, sectionKey))
    .orderBy(desc(business_profile_sections.version));
}
