import type { CandidateStage } from "@/lib/db/schema/candidates";

export const HIRING_STAGES = [
  { key: "sourced" as const, order: 1, full_time_only: false, label: "Sourced" },
  { key: "invited" as const, order: 2, full_time_only: false, label: "Invited" },
  { key: "applied" as const, order: 3, full_time_only: false, label: "Applied" },
  { key: "screened" as const, order: 4, full_time_only: false, label: "Screened" },
  { key: "trial" as const, order: 5, full_time_only: false, label: "Trial" },
  { key: "bench" as const, order: 6, full_time_only: false, label: "Bench" },
  { key: "archived" as const, order: 7, full_time_only: false, label: "Archived" },
] as const;

export const ARCHIVE_REASONS_BY_STAGE: Partial<
  Record<CandidateStage, readonly string[]>
> = {
  sourced: [
    "not_my_taste",
    "role_already_filled",
    "already_in_system",
    "other",
  ],
  invited: [
    "rate_off",
    "not_available",
    "portfolio_didnt_land",
    "wrong_city",
    "role_already_filled",
    "they_went_quiet",
    "other",
  ],
  applied: [
    "rate_off",
    "not_available",
    "portfolio_didnt_land",
    "wrong_city",
    "role_already_filled",
    "they_went_quiet",
    "other",
  ],
  screened: [
    "trial_didnt_land",
    "didnt_deliver",
    "communication_fell_apart",
    "rate_moved",
    "other",
  ],
  trial: [
    "trial_didnt_land",
    "didnt_deliver",
    "communication_fell_apart",
    "rate_moved",
    "other",
  ],
  bench: [
    "not_producing",
    "booked_up_elsewhere",
    "compliance_issue",
    "clean_parting",
    "they_moved_on",
    "other",
  ],
};

export const SKIP_TRIAL_REASONS = [
  "prior_relationship",
  "strong_referral",
  "immediate_need",
] as const;
export type SkipTrialReason = (typeof SKIP_TRIAL_REASONS)[number];
