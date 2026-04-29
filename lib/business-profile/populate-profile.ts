/**
 * Auto-populate all 10 business profile sections from available data sources:
 *   - Known constants (identity, design rules, voice rules)
 *   - Brand DNA assessment (signal tags, prose portrait)
 *   - SaaS products + tiers table (services)
 *   - Trial shoot pricing constants (services)
 *
 * Sections where data is knowable from the spec or codebase get fully
 * populated. Sections that need Andy's input (origin story, social proof,
 * current focus, positioning) get partial/placeholder data.
 *
 * After structured data is saved, prose summaries are generated for each
 * section via the existing Haiku LLM call.
 */

import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  business_profile_sections,
  BUSINESS_PROFILE_SECTION_KEYS,
} from "@/lib/db/schema/business-profile-sections";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { saas_products } from "@/lib/db/schema/saas-products";
import { saas_tiers } from "@/lib/db/schema/saas-tiers";
import { logActivity } from "@/lib/activity-log";
import { invalidateProfileCache } from "@/lib/business-profile/load-context";
import { generateProfileSnapshot } from "@/lib/business-profile/generate-snapshot";

type SectionData = Record<string, unknown>;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)} inc GST`;
}

async function loadBrandDnaContext(): Promise<{
  signalTags: string[];
  prosePortrait: string | null;
  businessContext: { businessDoes?: string; customers?: string; differentiator?: string } | null;
} | null> {
  const row = await db
    .select({
      signal_tags: brand_dna_profiles.signal_tags,
      prose_portrait: brand_dna_profiles.prose_portrait,
      business_context: brand_dna_profiles.business_context,
    })
    .from(brand_dna_profiles)
    .where(
      and(
        eq(brand_dna_profiles.subject_type, "superbad_self"),
        eq(brand_dna_profiles.is_current, true),
      ),
    )
    .get();

  if (!row) return null;

  let signalTags: string[] = [];
  try {
    if (row.signal_tags) {
      const parsed = JSON.parse(row.signal_tags) as Record<string, unknown>;
      signalTags = Object.keys(parsed).slice(0, 12);
    }
  } catch { /* skip */ }

  let businessContext: { businessDoes?: string; customers?: string; differentiator?: string } | null = null;
  try {
    if (row.business_context) {
      businessContext = JSON.parse(row.business_context) as typeof businessContext;
    }
  } catch { /* skip */ }

  return {
    signalTags,
    prosePortrait: row.prose_portrait,
    businessContext,
  };
}

async function loadServicesFromDb(): Promise<SectionData[]> {
  const products = await db
    .select({
      id: saas_products.id,
      name: saas_products.name,
      description: saas_products.description,
    })
    .from(saas_products)
    .where(eq(saas_products.status, "active"));

  const services: SectionData[] = [];

  // Trial shoot tiers (hardcoded, not in the products table)
  services.push({
    name: "Trial Shoot, Session",
    price_display: "$397 inc GST",
    price_cents: 39700,
    description: "60–90 min on-site. 1 short-form video, 10–15 edited photographs, a six-week marketing plan, private portal access.",
    is_recurring: false,
    billing_cadence: null,
    active: true,
  });
  services.push({
    name: "Trial Shoot, Production",
    price_display: "$597 inc GST",
    price_cents: 59700,
    description: "Up to 2 hours on-site. 2 short-form videos, 20–25 edited photographs, a six-week marketing plan, private portal access.",
    is_recurring: false,
    billing_cadence: null,
    active: true,
  });

  // SaaS products from database, join on actual product ID
  for (const product of products) {
    const tiers = await db
      .select({
        name: saas_tiers.name,
        monthly_price_cents_inc_gst: saas_tiers.monthly_price_cents_inc_gst,
        setup_fee_cents_inc_gst: saas_tiers.setup_fee_cents_inc_gst,
        tier_rank: saas_tiers.tier_rank,
      })
      .from(saas_tiers)
      .where(eq(saas_tiers.product_id, product.id));

    if (tiers.length === 0) {
      services.push({
        name: `${product.name} (SaaS)`,
        price_display: "Tiered pricing",
        price_cents: 0,
        description: product.description ?? `${product.name} SaaS product.`,
        is_recurring: true,
        billing_cadence: "monthly",
        active: true,
      });
      continue;
    }

    const sorted = [...tiers].sort((a, b) => a.tier_rank - b.tier_rank);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const priceRange = lowest.monthly_price_cents_inc_gst === highest.monthly_price_cents_inc_gst
      ? formatPrice(lowest.monthly_price_cents_inc_gst)
      : `${formatPrice(lowest.monthly_price_cents_inc_gst)}–${formatPrice(highest.monthly_price_cents_inc_gst)}/mo`;

    services.push({
      name: `${product.name} (SaaS)`,
      price_display: priceRange,
      price_cents: lowest.monthly_price_cents_inc_gst,
      description: product.description ?? `${product.name}, ${sorted.map(t => t.name).join(", ")} tiers.`,
      is_recurring: true,
      billing_cadence: "monthly",
      active: true,
    });
  }

  return services;
}

function buildIdentity(): SectionData {
  return {
    business_name: "SuperBad Marketing",
    legal_name: "SuperBad Media",
    founder_name: "Andy Robinson",
    location: "Melbourne, Australia",
    structure: "solo_founder",
    tagline: "Content that makes people feel something.",
    website_url: "superbadmedia.com.au",
    contact_email: "andy@superbadmedia.com.au",
  };
}

function buildAudience(brandDna: Awaited<ReturnType<typeof loadBrandDnaContext>>): SectionData {
  return {
    primary_description: brandDna?.businessContext?.customers ?? "Small-to-medium businesses in Melbourne and beyond",
    geography: "Melbourne on-site, Australia-wide remote, global for SaaS",
    verticals: [],
    vertical_philosophy: "If it's a real business, we'll find the story.",
    ideal_client_traits: [
      "Cares about how their brand looks and feels",
      "Has something real to say, not just chasing trends",
      "Ready to invest in content that lasts",
    ],
    anti_patterns: [
      "Wants templated, generic marketing",
      "Expects overnight virality",
      "Treats creative as a commodity",
    ],
  };
}

function buildPositioning(brandDna: Awaited<ReturnType<typeof loadBrandDnaContext>>): SectionData {
  return {
    one_liner: brandDna?.businessContext?.differentiator ?? "Entertainment-first marketing for businesses that actually have something to say.",
    differentiators: [
      "Entertainment anchor, content people want to watch, not skip",
      "Solo founder, no layers, Andy shoots, edits, and strategises",
      "AI-powered operations that look handmade",
      "No templated content, every piece is bespoke",
    ],
    philosophy: "Entertainment-first marketing. Content should feel like it was found, not targeted. High production, low ego, polished visuals with human, self-deprecating content inside them.",
    pricing_philosophy: "Value-first, no discounts. Trial shoot proves the work. Retainers and SaaS are priced for the outcome, not the hours.",
    competitors_context: "Most agencies sell hours or packages. SuperBad sells a feeling, the content is the proof, the strategy is the bonus.",
  };
}

function buildCurrentFocus(): SectionData {
  return {
    current_quarter_focus: "Launching SuperBad Lite platform, CRM, client portal, SaaS products, outreach automation",
    seasonal_emphasis: null,
    growth_priorities: [
      "Ship Lite v1.0 and migrate off GHL",
      "Build portfolio with trial shoots targeting >$500k businesses",
      "Launch outreach automation for trial shoot bookings",
    ],
    active_campaigns: [],
    recent_shifts: "Building a SaaS arm alongside the services business, platform becomes a product.",
  };
}

function buildExternalDesignRules(): SectionData {
  return {
    colour_palette: {
      primary: "#B22848",
      background: "#1A1A18",
      text: "#FDF5E6",
      accent_pink: "#F4A0B0",
      accent_orange: "#F28C52",
    },
    colour_ratio: "60% Dark Charcoal, 20% SuperBad Red, 10% Warm Cream, 6% Retro Pink, 4% Retro Orange",
    typography_display: "Black Han Sans, headlines and hero text only, never body",
    typography_labels: "Righteous, subheadings and labels, always uppercase, generous letter-spacing",
    typography_editorial: "Playfair Display, pull quotes and manifesto, italic preferred",
    typography_body: "DM Sans, body font, italic in Retro Pink for mutters and asides",
    typography_logo: "Pacifico, logo wordmark only, no other use",
    dark_over_light: true,
    visual_era: "1970s warmth, retro geometry, tactile imperfection, warm palettes. Brenton Wood album covers, vintage Penguin paperbacks",
    composition_style: "Wes Anderson, intentional framing, generous negative space, controlled density",
    photography_style: "Cinematic, candid over posed, real emotion over manufactured expression",
    typography_as_graphic: true,
    production_philosophy: "High production, low ego, polished and cinematic visuals with self-deprecating, human content inside them",
    overall_feeling: "Found, not targeted. Quietly confident. Warm not cold. Premium not corporate. Against the grain.",
    cultural_references: [
      "Wes Anderson, intentional framing, absurd premise with complete sincerity",
      "The Office + Fawlty Towers, characters who know exactly what's happening and say nothing",
      "Jimmy Carr, setup, punchline, nothing wasted",
      "Brenton Wood, unexpected, warm, slightly left of field",
    ],
    social_post_rules: "Typography-forward. Headlines as visual elements. No stock photography. No generic marketing layouts. Every post should feel like it belongs on a gallery wall, not a feed.",
    pdf_rules: "Branded cover page, company-name-derived filenames, visible SuperBad mark. Dark background default.",
    email_rules: "Minimal design, no heavy HTML templates. Dark palette. Copy does the work, not layout.",
  };
}

function buildInternalDesignRules(): SectionData {
  return {
    admin_shell: "Every admin page wraps in AdminShellWithNav, sidebar, animated nav, bottom nav for mobile, braindump FAB",
    page_chrome: "Every page gets: brand font/colour tokens, display heading (Black Han Sans), breadcrumb/eyebrow (Righteous, uppercase), narrative tagline (Playfair Display italic)",
    surface_strategy: "Warm stacked tints, dark charcoal base, surface cards at #222220, borders at #3A3A38",
    motion_house_spring: '{ type: "spring", stiffness: 300, damping: 30, mass: 1 }',
    motion_reduced: "Respect prefers-reduced-motion, instant reposition (duration: 0), never disable",
    radius_style: "Graduated soft radius, 6px for small elements, 8px for cards, never fully rounded",
    density_default: "Comfortable density, generous padding, readable spacing. Compact mode available via settings",
    empty_states: 'Never a blank screen. Three-state rule: loading → error → empty → success. Empty states get a dry one-liner',
    icon_library: "Lucide React, consistent across all surfaces",
    form_style: "No raw forms. All input flows wrapped in step-by-step wizards or inline editors. Never a wall of fields",
    table_style: "Clean tables with hover highlight, sticky headers, muted column labels in Righteous uppercase",
    sound_approach: "Subtle, Apple-satisfying. Visibility-gated (only fire if the triggering element is in viewport). Use-sound library",
    mobile_approach: "Desktop-first, mobile-functional. Bottom nav on mobile, responsive layouts, no horizontal scroll",
    no_generic_tailwind: "No default Tailwind styling on page chrome. Every surface uses brand tokens. If it looks like a template, it's wrong",
    accessibility_baseline: "WCAG 2.1 AA. Semantic HTML, keyboard navigable, screen reader tested on critical flows",
  };
}

function buildVoiceRules(brandDna: Awaited<ReturnType<typeof loadBrandDnaContext>>): SectionData {
  const toneMarkers = brandDna?.signalTags?.length
    ? brandDna.signalTags.slice(0, 6)
    : ["dry", "observational", "self-deprecating", "Melbourne wit"];

  return {
    tone_description: "Dry, observational, self-deprecating, slow burn",
    tone_markers: toneMarkers,
    banned_words: [
      "synergy", "leverage", "solutions", "elevate", "game-changer",
      "unlock", "journey", "ecosystem", "deliver value",
    ],
    sentence_style: "Short sentences. Leave room for the mutter.",
    humour_rules: "Never explain the joke. Real first.",
    register_admin: "Dry roommate who notices your habits",
    register_client: "Observant bartender who reads the room",
    register_public: "Observant bartender, warm, never pitchy",
    exclamation_marks: false,
    emoji_policy: "Only if the client uses them first",
  };
}

function buildSocialProof(): SectionData {
  return { proof_points: [] };
}

function buildOriginStory(): SectionData {
  return {
    short_version: null,
    full_version: null,
    founding_motivation: null,
    name_origin: null,
  };
}

export type PopulateResult = {
  ok: true;
  sectionsPopulated: number;
  sectionsSkipped: string[];
} | {
  ok: false;
  error: string;
};

export async function populateAllSections(userId: string): Promise<PopulateResult> {
  const brandDna = await loadBrandDnaContext();
  const services = await loadServicesFromDb();

  const sectionBuilders: Record<string, () => SectionData | Promise<SectionData>> = {
    identity: () => buildIdentity(),
    services: () => ({ services }),
    audience: () => buildAudience(brandDna),
    positioning: () => buildPositioning(brandDna),
    current_focus: () => buildCurrentFocus(),
    social_proof: () => buildSocialProof(),
    origin_story: () => buildOriginStory(),
    external_design_rules: () => buildExternalDesignRules(),
    internal_design_rules: () => buildInternalDesignRules(),
    voice_rules: () => buildVoiceRules(brandDna),
  };

  // Check which sections already have data
  const existingSections = await db
    .select({ section_key: business_profile_sections.section_key })
    .from(business_profile_sections)
    .where(eq(business_profile_sections.is_current, true));

  const existingKeys = new Set(existingSections.map(s => s.section_key));

  let populated = 0;
  const skipped: string[] = [];
  const now = Date.now();

  for (const key of BUSINESS_PROFILE_SECTION_KEYS) {
    if (existingKeys.has(key)) {
      skipped.push(key);
      continue;
    }

    const builder = sectionBuilders[key];
    if (!builder) continue;

    const structuredData = await builder();

    await db.insert(business_profile_sections).values({
      id: randomUUID(),
      section_key: key,
      structured_data: structuredData,
      prose_summary: null,
      prose_generated_at_ms: null,
      prose_manually_edited: false,
      version: 1,
      is_current: true,
      updated_by: "automated_detection",
      updated_at_ms: now,
      created_at_ms: now,
    });

    populated++;
  }

  // Generate prose for all newly populated sections (skip empty ones)
  const { invokeLlmText } = await import("@/lib/ai/invoke");

  const sectionsForProse = await db
    .select()
    .from(business_profile_sections)
    .where(
      and(
        eq(business_profile_sections.is_current, true),
        eq(business_profile_sections.prose_manually_edited, false),
      ),
    );

  for (const section of sectionsForProse) {
    if (section.prose_summary) continue;

    const data = section.structured_data as Record<string, unknown>;
    const hasReal = Object.values(data).some(v =>
      v !== null && v !== undefined &&
      !(Array.isArray(v) && v.length === 0) &&
      v !== "",
    );
    if (!hasReal) continue;

    const label = section.section_key.replace(/_/g, " ");
    const structuredJson = JSON.stringify(data, null, 2);

    try {
      const prose = await invokeLlmText({
        job: "profile-generate-prose-summary",
        prompt: `Summarise this "${label}" section of a business profile into 2-3 natural sentences. Write in third person. Be factual, not promotional.\n\n${structuredJson}`,
        maxTokens: 300,
        actorType: "internal",
      });

      await db
        .update(business_profile_sections)
        .set({
          prose_summary: prose,
          prose_generated_at_ms: Date.now(),
          updated_at_ms: Date.now(),
        })
        .where(eq(business_profile_sections.id, section.id));
    } catch {
      // prose generation is best-effort, section data is still saved
    }
  }

  invalidateProfileCache();

  try {
    await generateProfileSnapshot();
  } catch { /* best-effort */ }

  await logActivity({
    kind: "profile_auto_populated",
    body: `Auto-populated ${populated} profile sections (${skipped.length} skipped, already had data)`,
    createdBy: `user:${userId}`,
  });

  return { ok: true, sectionsPopulated: populated, sectionsSkipped: skipped };
}
