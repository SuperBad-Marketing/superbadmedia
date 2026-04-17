/** Supplement — Brand Override Bank. Source: docs/content/brand-dna/supplement.md */
import { sq, type SupplementQuestion } from "./types";

export const SUPPLEMENT_BANK: SupplementQuestion[] = [
  sq("sup_q01", "If your brand walked into a room without you, how would it carry itself differently?",
    ["More polished. You're rough around the edges \u2014 the brand can't be.", ["brand_override.communication.formality", "brand_override.aesthetic.geometric_precision"]],
    ["Warmer. You hold back \u2014 the brand should reach out.", ["brand_override.communication.warmth_in_voice", "brand_override.communication.extraversion"]],
    ["Quieter. You're the energy \u2014 the brand should be the substance.", ["brand_override.communication.introversion", "brand_override.communication.brevity"]],
    ["No differently. The brand IS the way I carry myself.", []]),

  sq("sup_q02", "Your natural tone and the brand's ideal tone \u2014 are they the same?",
    ["Close. The brand is a slightly more composed version of me.", ["brand_override.communication.tonal_awareness", "brand_override.communication.formality"]],
    ["Not really. I'm direct and informal \u2014 the brand needs more polish.", ["brand_override.communication.formality", "brand_override.aesthetic.minimalism"]],
    ["I'm warmer in person than the brand should be on paper. The brand should have more edge.", ["brand_override.communication.directness", "brand_override.communication.confrontation_comfort"]],
    ["They're identical. The brand sounds like me because it should.", []]),

  sq("sup_q03", "Your personal visual taste and what the brand needs to look like \u2014 same thing?",
    ["My taste is warmer and more textured. The brand needs to be cleaner.", ["brand_override.aesthetic.minimalism", "brand_override.aesthetic.geometric_precision"]],
    ["My taste is minimal. The brand needs more warmth and humanity than I'd naturally choose.", ["brand_override.aesthetic.warmth", "brand_override.aesthetic.organic_forms"]],
    ["My taste is bolder than what the brand should project. The brand needs restraint I don't have.", ["brand_override.aesthetic.muted_palette", "brand_override.creative.admires_restraint"]],
    ["Same thing. My taste IS the brand's visual identity.", []]),

  sq("sup_q04", "Your brand needs to live in one of these colour worlds. Which one \u2014 even if it's not what you'd pick for yourself?",
    ["Cool and precise \u2014 slate, white, ice blue, silver.", ["brand_override.aesthetic.minimalism", "brand_override.aesthetic.geometric_precision", "brand_override.aesthetic.high_contrast"]],
    ["Warm and grounded \u2014 clay, cream, olive, aged wood.", ["brand_override.aesthetic.warmth", "brand_override.aesthetic.organic_forms", "brand_override.aesthetic.analogue_texture"]],
    ["Bold and saturated \u2014 deep tones with one electric accent.", ["brand_override.aesthetic.high_contrast", "brand_override.aesthetic.maximalism"]],
    ["Muted and quiet \u2014 soft tones, low contrast, nothing shouts.", ["brand_override.aesthetic.muted_palette", "brand_override.creative.admires_restraint"]],
    true),

  sq("sup_q05", "You know your own appetite for risk. What about the brand's?",
    ["The brand should take fewer risks than I do. I can recover \u2014 the brand can't.", ["brand_override.values.risk_caution", "brand_override.values.prudence"]],
    ["The brand should take more risks than I naturally would. Playing it safe is how brands die.", ["brand_override.values.risk_appetite", "brand_override.creative.admires_boldness"]],
    ["Same appetite. The brand's risk tolerance IS my risk tolerance.", []],
    ["The brand should be strategic about risk. Bold where it counts, cautious everywhere else.", ["brand_override.values.pragmatism", "brand_override.values.head_first"]]),

  sq("sup_q06", "A customer is publicly unhappy with the brand. What should the brand's instinct be \u2014 even if yours would be different?",
    ["Acknowledge it fast. The brand doesn't have the luxury of sitting with it.", ["brand_override.communication.directness", "brand_override.communication.confrontation_comfort"]],
    ["Respond warmly. Even if I'd be defensive, the brand needs to lead with empathy.", ["brand_override.communication.warmth_in_voice", "brand_override.communication.agreeableness"]],
    ["Say less. The brand should be measured where I might be reactive.", ["brand_override.communication.brevity", "brand_override.values.patience"]],
    ["Handle it the way I'd handle it. My instinct IS the brand's instinct.", []]),

  sq("sup_q07", "How much of the messy, uncertain, human stuff should the brand show?",
    ["Less than I show. The brand needs to project confidence I don't always feel.", ["brand_override.aspiration.quiet_confidence", "brand_override.communication.formality"]],
    ["More than I show. I hold back \u2014 the brand should be braver about being real.", ["brand_override.communication.selective_vulnerability", "brand_override.values.authenticity"]],
    ["About the same. The brand's relationship with vulnerability mirrors mine.", []],
    ["Strategically. Show enough to be human, never enough to look uncertain.", ["brand_override.communication.tonal_awareness", "brand_override.communication.selective_vulnerability"]]),

  sq("sup_q08", "Your personal ambition and the brand's ambition \u2014 do they match?",
    ["I'm more ambitious than the brand needs to be. I push \u2014 the brand should feel settled.", ["brand_override.aspiration.quiet_confidence", "brand_override.values.patience"]],
    ["The brand should project more ambition than I feel. The market expects it.", ["brand_override.values.ambition", "brand_override.aspiration.achievement_orientation"]],
    ["Same drive. The brand's ambition is mine.", []],
    ["I want the brand to feel purposeful, not ambitious. Drive without hustle.", ["brand_override.aspiration.legacy_drive", "brand_override.values.authenticity"]]),

  sq("sup_q09", "You personally \u2014 are you a community person? Now: should the brand be?",
    ["I'm not, but the brand should be. Community builds something I can't build alone.", ["brand_override.aspiration.community_building", "brand_override.aspiration.affiliation"]],
    ["I am, but the brand shouldn't lean on it. The work should stand alone.", ["brand_override.aspiration.quiet_confidence", "brand_override.values.independence"]],
    ["We're aligned. The brand's community stance matches mine.", []],
    ["The brand should be selective. Not a community \u2014 a club.", ["brand_override.creative.curation_instinct", "brand_override.aspiration.premium_positioning"]]),

  sq("sup_q10", "You lean more toward authority or approachability. What about the brand?",
    ["I'm approachable. The brand needs more authority than I naturally project.", ["brand_override.aspiration.thought_leadership", "brand_override.aspiration.premium_positioning"]],
    ["I'm authoritative. The brand needs to be warmer than I am.", ["brand_override.communication.warmth_in_voice", "brand_override.aspiration.affiliation"]],
    ["Same balance. The brand sits where I sit.", []],
    ["The brand should be neither. It should be trusted \u2014 that's a different thing.", ["brand_override.values.authenticity", "brand_override.aspiration.quiet_confidence"]]),

  sq("sup_q11", "For the brand's photography \u2014 not what you personally love, but what the brand needs:",
    ["Clean and controlled. Every element placed.", ["brand_override.aesthetic.minimalism", "brand_override.aesthetic.geometric_precision"]],
    ["Warm and candid. Real moments, not staged ones.", ["brand_override.aesthetic.warmth", "brand_override.aesthetic.organic_forms"]],
    ["Dramatic and cinematic. Strong light, strong shadow.", ["brand_override.aesthetic.cinematic_eye", "brand_override.aesthetic.high_contrast"]],
    ["Raw and textured. Imperfection is the point.", ["brand_override.aesthetic.tactile_craft", "brand_override.creative.anti_polish"]],
    true),

  sq("sup_q12", "Your creative process is yours. What should the brand's be?",
    ["More structured than mine. I can improvise \u2014 the brand needs systems.", ["brand_override.values.conscientiousness", "brand_override.values.head_first"]],
    ["Looser than mine. I over-plan \u2014 the brand should feel more spontaneous.", ["brand_override.creative.improviser", "brand_override.values.gut_first"]],
    ["Same process. My way of working IS the brand's way.", []],
    ["More collaborative. I work alone \u2014 the brand should feel like it has a team behind it.", ["brand_override.aspiration.affiliation", "brand_override.communication.extraversion"]]),

  sq("sup_q13", "You have your own relationship to trends. What should the brand's be?",
    ["The brand should be more current than I am. I ignore trends \u2014 the brand can't afford to.", ["brand_override.creative.innovation_pull", "brand_override.values.openness"]],
    ["The brand should be more timeless than I am. I get pulled by new things \u2014 the brand shouldn't.", ["brand_override.creative.rejects_trend", "brand_override.creative.admires_craft"]],
    ["Same relationship. The brand and I respond to trends the same way.", []],
    ["The brand should acknowledge trends without following them. Aware, not reactive.", ["brand_override.values.pragmatism", "brand_override.creative.curation_instinct"]]),

  sq("sup_q14", "Your personal comfort with pricing and the brand's positioning \u2014 aligned?",
    ["I undercharge. The brand should project more premium confidence than I feel.", ["brand_override.aspiration.premium_positioning", "brand_override.aspiration.quiet_confidence"]],
    ["I'm comfortable with premium. But the brand should feel more accessible than I'd naturally set.", ["brand_override.communication.warmth_in_voice", "brand_override.values.agreeableness"]],
    ["Aligned. My pricing instinct is the brand's pricing instinct.", []],
    ["The brand should avoid the pricing conversation entirely. Compete on something else.", ["brand_override.aspiration.category_creation", "brand_override.values.independence"]]),

  sq("sup_q15", "Last one. If you stepped away tomorrow, what's the one thing the brand must keep \u2014 the thing that's you but also bigger than you?",
    ["The standard. Never let the quality drop, no matter who's doing the work.", ["brand_override.creative.admires_craft", "brand_override.values.perfectionism"]],
    ["The honesty. Don't start saying what people want to hear.", ["brand_override.values.authenticity", "brand_override.values.transparency"]],
    ["The feeling. There's something about this brand that people feel. Don't lose that.", ["brand_override.creative.emotional_resonance", "brand_override.aesthetic.warmth"]],
    ["The independence. Don't start following. Keep making the path.", ["brand_override.values.independence", "brand_override.values.conviction"]]),
];
