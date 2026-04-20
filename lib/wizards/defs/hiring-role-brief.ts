/**
 * `hiring-role-brief` — admin wizard for authoring a new Role Brief.
 *
 * 4 steps per spec §6.2:
 *   1. Role basics (form — name, engagement type, rate band, availability,
 *      location, open count)
 *   2. Reference portfolios (custom — multi-URL input, calls
 *      `ingestPortfolioUrl()` per URL with live status)
 *   3. LLM synthesis (custom — Sonnet reads ingested signals + basics,
 *      generates brief fields; Andy can override inline)
 *   4. Confirm + open (review-and-confirm — summary + status flip to 'open')
 *
 * Owner: HP-2. Spec: docs/specs/hiring-pipeline.md §6.
 */
import { registerWizard } from "@/lib/wizards/registry";
import type { WizardDefinition } from "@/lib/wizards/types";
import type { PortfolioSignal } from "@/lib/hiring/portfolio";

export type HiringRoleBriefPayload = {
  roleBriefId: string;
  roleName: string;
  engagementType: "contractor" | "employee";
  rateMinAud: number | null;
  rateMaxAud: number | null;
  targetHoursPerWeek: number | null;
  locationPrefCity: string | null;
  remoteOk: boolean;
  openCount: number;
  referenceUrls: string[];
  referenceSignals: PortfolioSignal[];
  styleSummary: string;
  extractedTags: string[];
  styleDoList: string[];
  styleAvoidList: string[];
  discoverySearchHints: string[];
  openedAt: number;
};

export const hiringRoleBriefWizard: WizardDefinition<HiringRoleBriefPayload> = {
  key: "hiring-role-brief",
  audience: "admin",
  renderMode: "dedicated-route",
  steps: [
    {
      key: "role-basics",
      type: "custom",
      label: "Role basics",
      resumable: true,
    },
    {
      key: "reference-portfolios",
      type: "custom",
      label: "References",
      resumable: true,
    },
    {
      key: "llm-synthesis",
      type: "custom",
      label: "Synthesis",
      resumable: false,
    },
    {
      key: "confirm-open",
      type: "review-and-confirm",
      label: "Open role",
      resumable: true,
      config: { ctaLabel: "Open this role" },
    },
  ],
  completionContract: {
    required: [
      "roleBriefId",
      "roleName",
      "engagementType",
      "referenceUrls",
      "styleSummary",
      "openedAt",
    ],
    verify: async () => ({ ok: true }),
    artefacts: { activityLog: "role_brief_opened" },
  },
  voiceTreatment: {
    introCopy:
      "New role — describe it, show us who you'd hire, and we'll build a brief that scouts for you.",
    outroCopy:
      "Role's open. Discovery starts within the hour.",
    tabTitlePool: {
      setup: ["Setup — New role brief"],
      connecting: ["Building brief…"],
      confirming: ["Opening role…"],
      connected: ["Role open."],
      stuck: ["Role brief — stuck?"],
    },
    capstone: undefined,
  },
};

registerWizard(hiringRoleBriefWizard);
