/**
 * Proposal content shape — typed structure for the sections_json column.
 *
 * Proposals are composed of ordered sections. Each section has a type
 * that determines its layout in both the web preview and PDF render.
 * The builder UI and PDF template both consume these types.
 */

/* ------------------------------------------------------------------ */
/* Section types                                                       */
/* ------------------------------------------------------------------ */

export interface CoverSection {
  type: "cover";
  data: {
    title: string;
    subtitle: string;
    details: { label: string; value: string }[];
    prepared_by: string;
    date: string;
    confidentiality_line?: string;
  };
}

export interface OpportunitySection {
  type: "opportunity";
  data: {
    heading: string;
    subheading: string;
    stats: { value: string; label: string }[];
    problem_heading: string;
    problem_body: string;
    insight_heading: string;
    insight_body: string;
    pull_quote: string;
  };
}

export interface ConceptSection {
  type: "concept";
  data: {
    heading: string;
    subheading: string;
    concept_title: string;
    concept_description: string;
    what_it_is: string[];
    what_it_isnt: string[];
    extras_heading?: string;
    extras_body?: string;
  };
}

export interface EcosystemSection {
  type: "ecosystem";
  data: {
    heading: string;
    subheading: string;
    layers: {
      label: string;
      items: string[];
    }[];
    footnote?: string;
  };
}

export interface AdvantagesSection {
  type: "advantages";
  data: {
    heading: string;
    subheading: string;
    advantages: {
      title: string;
      body: string;
    }[];
  };
}

export interface InvestmentOption {
  name: string;
  recommended?: boolean;
  line_items: string[];
  market_value?: string;
  price: string;
  price_suffix?: string;
}

export interface InvestmentSection {
  type: "investment";
  data: {
    heading: string;
    subheading: string;
    intro?: string;
    options: InvestmentOption[];
    ad_spend_note?: string;
  };
}

export interface NextStepsSection {
  type: "next_steps";
  data: {
    steps: { title: string; description: string }[];
    about_heading?: string;
    about_body?: string;
    cta_line?: string;
    cta_email?: string;
    cta_url?: string;
  };
}

export interface TextBlockSection {
  type: "text_block";
  data: {
    heading: string;
    subheading?: string;
    body: string;
  };
}

export interface TwoColumnSection {
  type: "two_column";
  data: {
    heading: string;
    subheading?: string;
    left_heading: string;
    left_items: string[];
    right_heading: string;
    right_items: string[];
  };
}

export type ProposalSection =
  | CoverSection
  | OpportunitySection
  | ConceptSection
  | EcosystemSection
  | AdvantagesSection
  | InvestmentSection
  | NextStepsSection
  | TextBlockSection
  | TwoColumnSection;

export type ProposalSectionType = ProposalSection["type"];

export const SECTION_TYPE_LABELS: Record<ProposalSectionType, string> = {
  cover: "Cover Page",
  opportunity: "The Opportunity",
  concept: "The Concept",
  ecosystem: "Content Ecosystem",
  advantages: "Why This Works",
  investment: "Your Investment",
  next_steps: "Next Steps",
  text_block: "Text Block",
  two_column: "Two Column",
};

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export function defaultSection(type: ProposalSectionType): ProposalSection {
  switch (type) {
    case "cover":
      return {
        type: "cover",
        data: {
          title: "",
          subtitle: "",
          details: [
            { label: "FORMAT", value: "" },
            { label: "APPROACH", value: "" },
            { label: "LOCATION", value: "" },
            { label: "CAMPAIGN", value: "" },
          ],
          prepared_by: "Andy Robinson",
          date: new Date().toLocaleDateString("en-AU", {
            month: "long",
            year: "numeric",
          }),
        },
      };
    case "opportunity":
      return {
        type: "opportunity",
        data: {
          heading: "THE OPPORTUNITY",
          subheading: "",
          stats: [
            { value: "", label: "" },
            { value: "", label: "" },
            { value: "", label: "" },
            { value: "", label: "" },
          ],
          problem_heading: "The Problem",
          problem_body: "",
          insight_heading: "The Insight",
          insight_body: "",
          pull_quote: "",
        },
      };
    case "concept":
      return {
        type: "concept",
        data: {
          heading: "THE CONCEPT",
          subheading: "",
          concept_title: "",
          concept_description: "",
          what_it_is: [""],
          what_it_isnt: [""],
        },
      };
    case "ecosystem":
      return {
        type: "ecosystem",
        data: {
          heading: "THE CONTENT ECOSYSTEM",
          subheading: "",
          layers: [
            { label: "ANCHOR CONTENT", items: [""] },
            { label: "DISTRIBUTION LAYER", items: [""] },
            { label: "PAID DISTRIBUTION", items: [""] },
            { label: "CONVERSION LAYER", items: [""] },
          ],
        },
      };
    case "advantages":
      return {
        type: "advantages",
        data: {
          heading: "WHY THIS WORKS",
          subheading: "",
          advantages: [
            { title: "", body: "" },
            { title: "", body: "" },
            { title: "", body: "" },
            { title: "", body: "" },
            { title: "", body: "" },
            { title: "", body: "" },
          ],
        },
      };
    case "investment":
      return {
        type: "investment",
        data: {
          heading: "YOUR INVESTMENT",
          subheading: "",
          options: [
            {
              name: "",
              line_items: [""],
              price: "",
            },
          ],
        },
      };
    case "next_steps":
      return {
        type: "next_steps",
        data: {
          steps: [
            { title: "Align on Vision", description: "" },
            { title: "Pre-Production", description: "" },
            { title: "Production", description: "" },
            { title: "Post-Production", description: "" },
            { title: "Campaign Launch", description: "" },
            { title: "Report & Scale", description: "" },
          ],
          about_heading: "ABOUT SUPERBAD",
          about_body:
            "SuperBad Marketing is a Melbourne-based performance marketing and creative media agency founded by Andy Robinson. We specialise in building content-driven acquisition systems for brands that want to grow with strategy, not spray-and-pray advertising.",
          cta_email: "andy@superbadmedia.com.au",
          cta_url: "superbadmedia.com.au",
        },
      };
    case "text_block":
      return {
        type: "text_block",
        data: { heading: "", body: "" },
      };
    case "two_column":
      return {
        type: "two_column",
        data: {
          heading: "",
          left_heading: "",
          left_items: [""],
          right_heading: "",
          right_items: [""],
        },
      };
  }
}

/* ------------------------------------------------------------------ */
/* Proposal template presets                                           */
/* ------------------------------------------------------------------ */

export interface ProposalTemplate {
  id: string;
  name: string;
  description: string;
  sections: ProposalSectionType[];
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: "content_play",
    name: "Content Play / Pilot Episode",
    description:
      "Docuseries-driven content ecosystem proposal with production, distribution, and conversion layers.",
    sections: [
      "cover",
      "opportunity",
      "concept",
      "ecosystem",
      "advantages",
      "investment",
      "next_steps",
    ],
  },
  {
    id: "retainer",
    name: "Retainer Proposal",
    description:
      "Ongoing services retainer with scope, deliverables, and monthly pricing.",
    sections: [
      "cover",
      "opportunity",
      "text_block",
      "advantages",
      "investment",
      "next_steps",
    ],
  },
  {
    id: "project",
    name: "Project Proposal",
    description:
      "One-off project with defined scope, deliverables, and timeline.",
    sections: [
      "cover",
      "text_block",
      "two_column",
      "investment",
      "next_steps",
    ],
  },
  {
    id: "ad_campaign",
    name: "Ad Campaign Proposal",
    description:
      "Meta/Google ad campaign proposal with strategy, creative, and budget breakdown.",
    sections: [
      "cover",
      "opportunity",
      "ecosystem",
      "advantages",
      "investment",
      "next_steps",
    ],
  },
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch — add sections as you go.",
    sections: ["cover", "next_steps"],
  },
];
