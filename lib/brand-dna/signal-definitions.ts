/**
 * Brand DNA signal tag definitions and domain mapping.
 *
 * Every signal tag used in the question banks has:
 *   1. A domain (one of five assessment sections)
 *   2. A static one-sentence definition
 *
 * The domain mapping is the single source of truth for tag → domain
 * resolution. Prompt builders and UI components both import from here.
 */

export const SIGNAL_DOMAINS = [
  "aesthetic",
  "communication",
  "values",
  "creative",
  "aspiration",
] as const;

export type SignalDomain = (typeof SIGNAL_DOMAINS)[number];

export const DOMAIN_LABELS: Record<SignalDomain, string> = {
  aesthetic: "Aesthetic Identity",
  communication: "Communication DNA",
  values: "Values & Instincts",
  creative: "Creative Compass",
  aspiration: "Brand Aspiration",
};

export const DOMAIN_COLORS: Record<SignalDomain, string> = {
  aesthetic: "#C4A0B0",
  communication: "#8BA89A",
  values: "#C4A87A",
  creative: "#A094C4",
  aspiration: "#7AAAB0",
};

interface SignalDefinition {
  domain: SignalDomain;
  definition: string;
}

export const SIGNAL_DEFINITIONS: Record<string, SignalDefinition> = {
  // ── aesthetic ──────────────────────────────────────────────────────
  warmth: {
    domain: "aesthetic",
    definition:
      "A gravitational pull toward approachability and human texture over clinical precision.",
  },
  minimalism: {
    domain: "aesthetic",
    definition:
      "A preference for restraint, negative space, and letting fewer elements carry more weight.",
  },
  maximalism: {
    domain: "aesthetic",
    definition:
      "A comfort with density, layering, and visual abundance that rewards attention.",
  },
  organic_forms: {
    domain: "aesthetic",
    definition:
      "An instinct toward irregular, natural shapes over rigid geometry.",
  },
  geometric_precision: {
    domain: "aesthetic",
    definition:
      "A pull toward clean lines, symmetry, and mathematically satisfying structure.",
  },
  analogue_texture: {
    domain: "aesthetic",
    definition:
      "A preference for surfaces that feel touched, worn, or handmade rather than digitally perfect.",
  },
  high_contrast: {
    domain: "aesthetic",
    definition:
      "A taste for bold tonal separation and visual tension between light and dark.",
  },
  muted_palette: {
    domain: "aesthetic",
    definition:
      "A bias toward desaturated, quiet colour that doesn't compete for attention.",
  },
  cinematic_eye: {
    domain: "aesthetic",
    definition:
      "A way of seeing that frames moments like film stills, drawn to depth, light, and mood.",
  },
  tactile_craft: {
    domain: "aesthetic",
    definition:
      "A respect for things that look like they were made by hand, slowly and with care.",
  },
  sensory_memory: {
    domain: "aesthetic",
    definition:
      "A tendency to anchor identity in texture, smell, sound, and physical detail.",
  },
  curation_instinct: {
    domain: "aesthetic",
    definition:
      "A compulsion to select, arrange, and edit rather than create from nothing.",
  },

  // ── communication ──────────────────────────────────────────────────
  directness: {
    domain: "communication",
    definition:
      "A preference for saying the thing plainly, without softening or circling around it.",
  },
  dry_humour: {
    domain: "communication",
    definition:
      "A comedic instinct that plays it straight and trusts the audience to catch the joke.",
  },
  brevity: {
    domain: "communication",
    definition:
      "A bias toward fewer words, believing most things can be said in half the space.",
  },
  warmth_in_voice: {
    domain: "communication",
    definition:
      "A natural register that makes people feel safe, seen, and welcome.",
  },
  storytelling: {
    domain: "communication",
    definition:
      "A default to narrative structure when explaining, persuading, or connecting.",
  },
  formality: {
    domain: "communication",
    definition:
      "A preference for professional register and structured communication over casual tone.",
  },
  confrontation_comfort: {
    domain: "communication",
    definition:
      "A willingness to name the uncomfortable thing in a room without flinching.",
  },
  listen_first: {
    domain: "communication",
    definition:
      "A pattern of absorbing fully before responding, often asking better questions than giving answers.",
  },
  provocation: {
    domain: "communication",
    definition:
      "A willingness to say something slightly uncomfortable to move a conversation forward.",
  },
  selective_vulnerability: {
    domain: "communication",
    definition:
      "A controlled willingness to show real feeling, deployed strategically rather than compulsively.",
  },
  tonal_awareness: {
    domain: "communication",
    definition:
      "A sensitivity to how things land, adjusting register for audience and moment.",
  },
  introversion: {
    domain: "communication",
    definition:
      "An energy pattern that recharges in solitude and depletes in extended social settings.",
  },
  extraversion: {
    domain: "communication",
    definition:
      "An energy pattern that gains momentum from interaction and withers in isolation.",
  },
  conflict_avoidant: {
    domain: "communication",
    definition:
      "A strong preference for harmony, sometimes at the cost of saying what needs saying.",
  },
  agreeableness: {
    domain: "communication",
    definition:
      "A natural cooperativeness that prioritises group cohesion over individual assertion.",
  },
  self_deprecating_humour: {
    domain: "communication",
    definition:
      "A comedic reflex that turns the lens inward, using self-awareness as a disarming tool.",
  },
  observational_humour: {
    domain: "communication",
    definition:
      "A noticing instinct that finds comedy in the gap between how things are and how they present.",
  },
  absurdist_humour: {
    domain: "communication",
    definition:
      "A willingness to abandon logic for comic effect, trusting that the non-sequitur lands.",
  },

  // ── values ─────────────────────────────────────────────────────────
  authenticity: {
    domain: "values",
    definition:
      "A deep discomfort with pretence, and a need for what's presented to match what's real.",
  },
  risk_appetite: {
    domain: "values",
    definition:
      "A willingness to bet on uncertain outcomes when the upside feels worth it.",
  },
  risk_caution: {
    domain: "values",
    definition:
      "A preference for measured moves, where downside is contained before upside is chased.",
  },
  patience: {
    domain: "values",
    definition:
      "A bias toward deliberate timing over reactive speed, trusting that the right moment arrives.",
  },
  perfectionism: {
    domain: "values",
    definition:
      "A standard that won't ship until the last detail is right, even when good enough would do.",
  },
  pragmatism: {
    domain: "values",
    definition:
      "A bias toward what works over what's ideal, valuing outcomes more than principles.",
  },
  independence: {
    domain: "values",
    definition:
      "A need to operate on your own terms, even when consensus would be easier.",
  },
  loyalty: {
    domain: "values",
    definition:
      "A tendency to invest deeply in relationships and stick long past the point others would walk.",
  },
  transparency: {
    domain: "values",
    definition:
      "A default to showing the working, believing trust is built by letting people see the full picture.",
  },
  conviction: {
    domain: "values",
    definition:
      "A willingness to hold a position under pressure when you believe you're right.",
  },
  control_need: {
    domain: "values",
    definition:
      "A preference for steering the process, uncomfortable when outcomes depend on someone else's judgment.",
  },
  legacy_drive: {
    domain: "values",
    definition:
      "A motivation shaped by what gets left behind, not just what gets built now.",
  },
  gut_first: {
    domain: "values",
    definition:
      "A decision-making pattern that leads with instinct and builds the rationale after.",
  },
  head_first: {
    domain: "values",
    definition:
      "A decision-making pattern that won't commit until the logic is airtight.",
  },
  high_sensitivity: {
    domain: "values",
    definition:
      "An awareness dial turned up high, picking up signals most people miss entirely.",
  },
  thick_skin: {
    domain: "values",
    definition:
      "An ability to absorb criticism without it changing the course, letting most noise bounce.",
  },
  openness: {
    domain: "values",
    definition:
      "A genuine curiosity about unfamiliar ideas and a willingness to revise assumptions.",
  },
  conscientiousness: {
    domain: "values",
    definition:
      "A reliability that follows through on commitments and keeps the details from slipping.",
  },
  neuroticism: {
    domain: "values",
    definition:
      "A tendency to anticipate what could go wrong, which sometimes catches problems early and sometimes creates them.",
  },
  resilience: {
    domain: "values",
    definition:
      "A capacity to absorb setbacks and come back operating at the same level.",
  },
  curiosity: {
    domain: "values",
    definition:
      "A pull toward understanding that isn't satisfied until the mechanism is visible.",
  },
  prudence: {
    domain: "values",
    definition:
      "A habit of thinking two steps ahead before acting, preferring preparation over spontaneity.",
  },
  ambition: {
    domain: "values",
    definition:
      "A forward energy that's always measuring the gap between where things are and where they should be.",
  },

  // ── creative ───────────────────────────────────────────────────────
  admires_restraint: {
    domain: "creative",
    definition:
      "A respect for work that knows when to stop, where the discipline is in what got left out.",
  },
  admires_boldness: {
    domain: "creative",
    definition:
      "A respect for work that takes a visible risk and owns the consequences.",
  },
  admires_craft: {
    domain: "creative",
    definition:
      "A respect for visible skill and care in execution, regardless of style or genre.",
  },
  rejects_trend: {
    domain: "creative",
    definition:
      "A suspicion of whatever everyone else is doing, preferring to arrive at a position independently.",
  },
  genre_fluency: {
    domain: "creative",
    definition:
      "A comfort moving across styles and references, drawing from a wide library rather than one aesthetic.",
  },
  nostalgia_pull: {
    domain: "creative",
    definition:
      "A creative centre of gravity that keeps returning to things that felt like they mattered once.",
  },
  innovation_pull: {
    domain: "creative",
    definition:
      "A creative centre of gravity that leans forward, more interested in what hasn't been tried.",
  },
  emotional_resonance: {
    domain: "creative",
    definition:
      "A measure of creative quality based on whether it makes someone feel something real.",
  },
  intellectual_depth: {
    domain: "creative",
    definition:
      "A preference for work that rewards sustained attention and reveals layers on revisit.",
  },
  visual_storytelling: {
    domain: "creative",
    definition:
      "A belief that the right image does what paragraphs of copy cannot.",
  },
  taste_as_identity: {
    domain: "creative",
    definition:
      "A relationship with aesthetic preference that goes beyond liking things into defining the self through them.",
  },
  anti_polish: {
    domain: "creative",
    definition:
      "A deliberate preference for rough edges, believing that too-clean work loses its honesty.",
  },
  improviser: {
    domain: "creative",
    definition:
      "A creative process built on responding to what emerges rather than executing a plan.",
  },

  // ── aspiration ─────────────────────────────────────────────────────
  premium_positioning: {
    domain: "aspiration",
    definition:
      "A vision of the brand as best-in-class, where price signals quality and exclusivity is the point.",
  },
  underdog_energy: {
    domain: "aspiration",
    definition:
      "A brand identity that draws power from being smaller, scrappier, and less expected.",
  },
  quiet_confidence: {
    domain: "aspiration",
    definition:
      "A brand posture that lets the work speak, never raising its voice to prove a point.",
  },
  category_creation: {
    domain: "aspiration",
    definition:
      "An ambition to define the space rather than compete within existing terms.",
  },
  personality_forward: {
    domain: "aspiration",
    definition:
      "A brand strategy where the founder's character is the primary asset and differentiator.",
  },
  community_building: {
    domain: "aspiration",
    definition:
      "A belief that the brand's value grows from the people around it, not just the product.",
  },
  thought_leadership: {
    domain: "aspiration",
    definition:
      "An ambition to shape how the industry thinks, not just participate in it.",
  },
  proving_ground: {
    domain: "aspiration",
    definition:
      "A motivation fuelled by wanting to demonstrate capability, often to a specific audience.",
  },
  reputation_weight: {
    domain: "aspiration",
    definition:
      "A sensitivity to how the brand is perceived, where reputation is a load-bearing asset.",
  },
  global_ambition: {
    domain: "aspiration",
    definition:
      "A vision that doesn't accept geographic boundaries as limits on where the brand operates.",
  },
  local_roots: {
    domain: "aspiration",
    definition:
      "A brand identity anchored in place, where geography is a strength rather than a constraint.",
  },
  achievement_orientation: {
    domain: "aspiration",
    definition:
      "A drive measured in milestones hit and targets cleared, where progress is the fuel.",
  },
  affiliation: {
    domain: "aspiration",
    definition:
      "A motivation shaped by belonging and connection, where relationships are the measure of success.",
  },
  power_drive: {
    domain: "aspiration",
    definition:
      "A motivation drawn to influence and leverage, wanting to shape outcomes at scale.",
  },
  systems_forward: {
    domain: "aspiration",
    definition:
      "A belief that the brand's competitive edge comes from how well the machine runs, not individual heroics.",
  },
} as const;

export function domainForTag(tag: string): SignalDomain | null {
  return SIGNAL_DEFINITIONS[tag]?.domain ?? null;
}

export function definitionForTag(tag: string): string | null {
  return SIGNAL_DEFINITIONS[tag]?.definition ?? null;
}

export function formatTagName(tag: string): string {
  return tag
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
