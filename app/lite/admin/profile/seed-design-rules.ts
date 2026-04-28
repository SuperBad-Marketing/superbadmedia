"use server";

import { saveSectionAction } from "./actions";

export const EXTERNAL_DESIGN_RULES_SEED: Record<string, unknown> = {
  colour_palette: {
    primary: "#B22848",
    background: "#1A1A18",
    text: "#FDF5E6",
    accent_pink: "#F4A0B0",
    accent_orange: "#F28C52",
  },
  colour_ratio:
    "60% Dark Charcoal, 20% SuperBad Red, 10% Warm Cream, 6% Retro Pink, 4% Retro Orange",
  typography_display:
    "Black Han Sans — headlines and hero text only, never body",
  typography_labels:
    "Righteous — subheadings and labels, always uppercase, generous letter-spacing",
  typography_editorial:
    "Playfair Display — pull quotes and manifesto, italic preferred",
  typography_body:
    "DM Sans — body font, italic in Retro Pink for mutters and asides",
  typography_logo: "Pacifico — logo wordmark only, no other use",
  dark_over_light: true,
  visual_era:
    "1970s warmth — retro geometry, tactile imperfection, warm palettes. Brenton Wood album covers, vintage Penguin paperbacks",
  composition_style:
    "Wes Anderson — intentional framing, generous negative space, controlled density",
  photography_style:
    "Cinematic, candid over posed, real emotion over manufactured expression",
  typography_as_graphic: true,
  production_philosophy:
    "High production, low ego — polished and cinematic visuals with self-deprecating, human content inside them",
  overall_feeling:
    "Found, not targeted. Quietly confident. Warm not cold. Premium not corporate. Against the grain.",
  cultural_references: [
    "Wes Anderson — intentional framing, absurd premise with complete sincerity",
    "The Office + Fawlty Towers — characters who know exactly what's happening and say nothing",
    "Jimmy Carr — setup, punchline, nothing wasted",
    "Brenton Wood — unexpected, warm, slightly left of field",
  ],
  social_post_rules:
    "Typography-forward. Headlines as visual elements. No stock photography. No generic marketing layouts. Every post should feel like it belongs on a gallery wall, not a feed.",
  pdf_rules:
    "Branded cover page, company-name-derived filenames, visible SuperBad mark. Dark background default.",
  email_rules:
    "Minimal design, no heavy HTML templates. Dark palette. Copy does the work, not layout.",
};

export const INTERNAL_DESIGN_RULES_SEED: Record<string, unknown> = {
  admin_shell:
    "Every admin page wraps in AdminShellWithNav — sidebar, animated nav, bottom nav for mobile, braindump FAB",
  page_chrome:
    "Every page gets: brand font/colour tokens, display heading (Black Han Sans), breadcrumb/eyebrow (Righteous, uppercase), narrative tagline (Playfair Display italic)",
  surface_strategy:
    "Warm stacked tints — dark charcoal base (#1A1A18), surface cards at #252320, borders at #3D3D37",
  motion_house_spring:
    '{ type: "spring", stiffness: 220, damping: 25, mass: 1 } — every state change animates with this',
  motion_reduced:
    "Respect prefers-reduced-motion — instant reposition (duration: 0), never disable",
  radius_style:
    "Graduated soft radius — 4px tight, 8px default, 16px generous. Never fully rounded",
  density_default:
    "Comfortable density — generous padding, readable spacing. Compact mode available via settings",
  empty_states:
    'Never a blank screen. Three-state rule: loading → error → empty → success. Empty states get a dry one-liner',
  icon_library: "Lucide React — consistent across all surfaces",
  form_style:
    "No raw forms. All input flows wrapped in step-by-step wizards or inline editors. Never a wall of fields",
  table_style:
    "Clean tables with hover highlight, sticky headers, muted column labels in Righteous uppercase",
  sound_approach:
    "Subtle, Apple-satisfying. Visibility-gated (only fire if the triggering element is in viewport). Use-sound library",
  mobile_approach:
    "Desktop-first, mobile-functional. Bottom nav on mobile, responsive layouts, no horizontal scroll",
  no_generic_tailwind:
    "No default Tailwind styling on page chrome. Every surface uses brand tokens. If it looks like a template, it's wrong",
  accessibility_baseline:
    "WCAG 2.1 AA. Semantic HTML, keyboard navigable, screen reader tested on critical flows",
};

export async function seedDesignRulesAction(): Promise<{
  external: boolean;
  internal: boolean;
}> {
  const extResult = await saveSectionAction(
    "external_design_rules",
    EXTERNAL_DESIGN_RULES_SEED,
  );
  const intResult = await saveSectionAction(
    "internal_design_rules",
    INTERNAL_DESIGN_RULES_SEED,
  );
  return {
    external: extResult.ok,
    internal: intResult.ok,
  };
}
