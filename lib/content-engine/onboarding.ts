/**
 * Content Engine — onboarding wizard helpers (CE-12).
 *
 * Spec: docs/specs/content-engine.md §3.3.
 * Step 1: domain verification (Cloudflare path routing + Resend SPF/DKIM).
 * Step 2: seed keyword review (auto-derived from Brand DNA).
 * Step 3: newsletter preferences (send window + optional CSV import + embed form token).
 *
 * Owner: CE-12. Consumers: onboarding wizard definition + server actions.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db as defaultDb } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { companies } from "@/lib/db/schema/companies";
import { logActivity } from "@/lib/activity-log";
import { ensureContentGenerationEnqueued } from "@/lib/scheduled-tasks/handlers/content-generate-draft";

// ── Types ────────────────────────────────────────────────────────────────────

export type DerivedSeedKeywords = {
  keywords: string[];
  sources: Array<{ keyword: string; source: string }>;
};

export type OnboardingCompletionPayload = {
  domainVerified: boolean;
  seedKeywordsConfirmed: string[];
  sendWindowDay: string;
  sendWindowTime: string;
  sendWindowTz: string;
  csvImported: boolean;
  embedFormTokenGenerated: boolean;
  completedAt: number;
};

// ── Seed keyword derivation ─────────────────────────────────────────────────

/**
 * Derive seed keywords from a company's Brand DNA signals + industry vertical
 * + location. Spec §3.3 Step 2: "auto-derived from Brand DNA signals +
 * vertical + location for subscribers."
 *
 * Returns both the keywords and their derivation sources so the UI can show
 * the subscriber why each keyword was suggested.
 */
export async function deriveSeedKeywords(
  companyId: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<DerivedSeedKeywords> {
  const database = deps.db ?? defaultDb;
  const keywords: Array<{ keyword: string; source: string }> = [];

  // 1. Company vertical + location
  const company = await database
    .select({
      industry_vertical: companies.industry_vertical,
      industry_vertical_other: companies.industry_vertical_other,
      location: companies.location,
      name: companies.name,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (company) {
    const vertical =
      company.industry_vertical === "other"
        ? company.industry_vertical_other
        : company.industry_vertical;

    if (vertical) {
      keywords.push({ keyword: vertical.toLowerCase(), source: "industry vertical" });
    }
    if (company.location) {
      // Combine vertical + location for local SEO keywords
      if (vertical) {
        keywords.push({
          keyword: `${vertical.toLowerCase()} ${company.location.toLowerCase()}`,
          source: "vertical + location",
        });
      }
      keywords.push({
        keyword: company.location.toLowerCase(),
        source: "business location",
      });
    }
  }

  // 2. Brand DNA signal tags — extract domain-level tags
  const profile = await database
    .select({ signal_tags: brand_dna_profiles.signal_tags })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (profile?.signal_tags) {
    try {
      const tags = JSON.parse(profile.signal_tags as string) as Record<
        string,
        Record<string, number>
      >;

      // Extract top tags across all domains (highest frequency first)
      const allTags: Array<{ tag: string; freq: number; domain: string }> = [];
      for (const [domain, tagMap] of Object.entries(tags)) {
        for (const [tag, freq] of Object.entries(tagMap)) {
          allTags.push({ tag, freq: freq as number, domain });
        }
      }
      allTags.sort((a, b) => b.freq - a.freq);

      // Take top 5 tags as seed keywords
      const seen = new Set(keywords.map((k) => k.keyword));
      for (const { tag, domain } of allTags.slice(0, 8)) {
        const normalised = tag.toLowerCase().replace(/_/g, " ");
        if (!seen.has(normalised)) {
          seen.add(normalised);
          keywords.push({ keyword: normalised, source: `Brand DNA — ${domain}` });
        }
        if (keywords.length >= 8) break;
      }
    } catch {
      // Malformed signal_tags — proceed without
    }
  }

  return {
    keywords: keywords.map((k) => k.keyword),
    sources: keywords,
  };
}

// ── Config initialisation ───────────────────────────────────────────────────

/**
 * Ensure a content_engine_config row exists for a company. Idempotent —
 * returns the existing row if one already exists.
 */
export async function ensureContentEngineConfig(
  companyId: string,
  deps: { db?: typeof defaultDb } = {},
): Promise<{ id: string; isNew: boolean }> {
  const database = deps.db ?? defaultDb;

  const existing = await database
    .select({ id: contentEngineConfig.id })
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) return { id: existing.id, isNew: false };

  const id = randomUUID();
  const now = Date.now();
  await database.insert(contentEngineConfig).values({
    id,
    company_id: companyId,
    embed_form_token: randomUUID(),
    created_at_ms: now,
    updated_at_ms: now,
  });

  return { id, isNew: true };
}

// ── Wizard completion ───────────────────────────────────────────────────────

/**
 * Finalise the Content Engine onboarding wizard. Called by the completion
 * contract verify or by the server action on the final step.
 *
 * - Saves seed keywords to content_engine_config
 * - Saves newsletter send window preferences
 * - Generates embed form token if not already present
 * - Kicks off the content generation pipeline
 * - Logs activity
 */
export async function completeContentEngineOnboarding(
  companyId: string,
  payload: OnboardingCompletionPayload,
  deps: { db?: typeof defaultDb } = {},
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const database = deps.db ?? defaultDb;

  const config = await database
    .select({ id: contentEngineConfig.id })
    .from(contentEngineConfig)
    .where(eq(contentEngineConfig.company_id, companyId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!config) {
    return { ok: false, reason: "No content engine config found for this company." };
  }

  const now = Date.now();

  await database
    .update(contentEngineConfig)
    .set({
      seed_keywords: payload.seedKeywordsConfirmed as unknown as string,
      send_window_day: payload.sendWindowDay as typeof contentEngineConfig.$inferSelect.send_window_day,
      send_window_time: payload.sendWindowTime,
      send_window_tz: payload.sendWindowTz,
      embed_form_token:
        payload.embedFormTokenGenerated
          ? (
              await database
                .select({ embed_form_token: contentEngineConfig.embed_form_token })
                .from(contentEngineConfig)
                .where(eq(contentEngineConfig.id, config.id))
                .limit(1)
                .then((rows) => rows[0]?.embed_form_token)
            ) ?? randomUUID()
          : undefined,
      updated_at_ms: now,
    })
    .where(eq(contentEngineConfig.id, config.id));

  // Kick off research pipeline — spec §3.3: "Engine starts keyword research
  // immediately after step 2."
  await ensureContentGenerationEnqueued(companyId, now);

  await logActivity({
    companyId,
    kind: "wizard_completed",
    body: "Content Engine onboarding wizard completed.",
    meta: {
      wizardKey: "content-engine-onboarding",
      seedKeywordCount: payload.seedKeywordsConfirmed.length,
      sendWindow: `${payload.sendWindowDay} ${payload.sendWindowTime} ${payload.sendWindowTz}`,
    },
  });

  return { ok: true };
}
