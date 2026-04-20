import type { ActorType } from "@/lib/db/schema/hidden-egg-fires";

export type EggRegister = "admin-roommate" | "public-bartender" | "customer-bartender";

export interface EggDefinition {
  id: string;
  name: string;
  register: EggRegister;
  cooldownDays: number;
  exemptFromBudget: boolean;
  description: string;
}

export const ADMIN_EGGS: EggDefinition[] = [
  {
    id: "crt_turn_off",
    name: "CRT Turn-Off",
    register: "admin-roommate",
    cooldownDays: 30,
    exemptFromBudget: false,
    description: "Late-night session CRT shutdown effect",
  },
  {
    id: "milestone_spotter",
    name: "Milestone Spotter",
    register: "admin-roommate",
    cooldownDays: 0, // per-contact 60d window, not global
    exemptFromBudget: false,
    description: "Surfaces upcoming personal/business milestones from notes",
  },
  {
    id: "three_wons",
    name: "Three Wons in a Session",
    register: "admin-roommate",
    cooldownDays: 30,
    exemptFromBudget: false,
    description: "Dry toast on third deal Won in a session",
  },
];

export const PUBLIC_EGGS: EggDefinition[] = [
  {
    id: "late_night_visitor",
    name: "Late-Night Visitor",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "Visitor between 2am-5am local time",
  },
  {
    id: "sunday_researcher",
    name: "Sunday Researcher",
    register: "public-bartender",
    cooldownDays: Infinity, // one-shot
    exemptFromBudget: false,
    description: "Sunday + search engine referrer + 45s dwell",
  },
  {
    id: "melbourne_public_holiday",
    name: "Melbourne Public Holiday",
    register: "public-bartender",
    cooldownDays: 0, // structural, fires every holiday visit
    exemptFromBudget: true,
    description: "Site closure on Australian public holidays",
  },
  {
    id: "fifth_time_visitor",
    name: "Fifth-Time Visitor",
    register: "public-bartender",
    cooldownDays: Infinity,
    exemptFromBudget: false,
    description: "5th distinct calendar-day visit",
  },
  {
    id: "returning_visitor",
    name: "Returning Visitor",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "2nd+ visit within 30 days (not 5th-visit)",
  },
  {
    id: "linkedin_referrer",
    name: "LinkedIn Referrer",
    register: "public-bartender",
    cooldownDays: 30,
    exemptFromBudget: false,
    description: "Referrer from LinkedIn",
  },
  {
    id: "google_intent_cheap",
    name: "Google Intent — Cheap/Discount",
    register: "public-bartender",
    cooldownDays: Infinity,
    exemptFromBudget: false,
    description: "Search query contains cheap/discount/budget terms",
  },
  {
    id: "rapid_scroller",
    name: "Rapid Scroller",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "Scrolled top-to-bottom in under 6 seconds",
  },
  {
    id: "deep_reader",
    name: "Deep Reader",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "4+ minutes dwell, 70%+ scroll depth",
  },
  {
    id: "abandoned_tab",
    name: "Abandoned Tab",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "Tab backgrounded 10+ minutes then refocused",
  },
  {
    id: "melbourne_rain",
    name: "Melbourne Rain",
    register: "public-bartender",
    cooldownDays: 14,
    exemptFromBudget: false,
    description: "Melbourne timezone + active precipitation",
  },
  {
    id: "public_crt_turn_off",
    name: "Public CRT Turn-Off",
    register: "public-bartender",
    cooldownDays: 30,
    exemptFromBudget: true,
    description: "Structural closure for late-night Melbourne visitors",
  },
];

export const ALL_EGGS: EggDefinition[] = [...ADMIN_EGGS, ...PUBLIC_EGGS];

export function getEggById(id: string): EggDefinition | undefined {
  return ALL_EGGS.find((e) => e.id === id);
}

export function getEggsForRegister(register: EggRegister): EggDefinition[] {
  return ALL_EGGS.filter((e) => e.register === register);
}

export function getRegisterForActorType(actorType: ActorType): EggRegister {
  switch (actorType) {
    case "admin":
      return "admin-roommate";
    case "customer":
      return "customer-bartender";
    case "public":
      return "public-bartender";
  }
}
