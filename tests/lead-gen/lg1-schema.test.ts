import { describe, it, expect } from "vitest";

// Schema imports — verifying all tables export correctly
import {
  leadCandidates,
  CANDIDATE_EMAIL_CONFIDENCES,
  CANDIDATE_SOURCES,
  CANDIDATE_TRACKS,
} from "@/lib/db/schema/lead-candidates";
import {
  outreachDrafts,
  OUTREACH_TOUCH_KINDS,
  OUTREACH_DRAFT_STATUSES,
  OUTREACH_APPROVAL_KINDS,
} from "@/lib/db/schema/outreach-drafts";
import {
  outreachSends,
  OUTREACH_BOUNCE_KINDS,
} from "@/lib/db/schema/outreach-sends";
import {
  outreachSequences,
  OUTREACH_SEQUENCE_STATUSES,
} from "@/lib/db/schema/outreach-sequences";
import { leadRuns, LEAD_RUN_TRIGGERS } from "@/lib/db/schema/lead-runs";
import {
  dncEmails,
  dncDomains,
  DNC_EMAIL_SOURCES,
} from "@/lib/db/schema/dnc";
import { resendWarmupState } from "@/lib/db/schema/resend-warmup-state";
import { autonomyState, AUTONOMY_MODES } from "@/lib/db/schema/autonomy-state";
import { ACTIVITY_LOG_KINDS } from "@/lib/db/schema/activity-log";
import { SCHEDULED_TASK_TYPES } from "@/lib/db/schema/scheduled-tasks";
import { CONTACT_EMAIL_STATUSES } from "@/lib/db/schema/contacts";

describe("LG-1 schema — table exports", () => {
  it("exports lead_candidates with expected columns", () => {
    expect(leadCandidates).toBeDefined();
    expect(leadCandidates.id).toBeDefined();
    expect(leadCandidates.company_name).toBeDefined();
    expect(leadCandidates.viability_profile_json).toBeDefined();
    expect(leadCandidates.qualified_track).toBeDefined();
  });

  it("exports outreach_drafts with expected columns", () => {
    expect(outreachDrafts).toBeDefined();
    expect(outreachDrafts.id).toBeDefined();
    expect(outreachDrafts.subject).toBeDefined();
    expect(outreachDrafts.body_markdown).toBeDefined();
    expect(outreachDrafts.status).toBeDefined();
  });

  it("exports outreach_sends with expected columns", () => {
    expect(outreachSends).toBeDefined();
    expect(outreachSends.id).toBeDefined();
    expect(outreachSends.resend_message_id).toBeDefined();
    expect(outreachSends.engagement_tier).toBeDefined();
  });

  it("exports outreach_sequences with expected columns", () => {
    expect(outreachSequences).toBeDefined();
    expect(outreachSequences.id).toBeDefined();
    expect(outreachSequences.deal_id).toBeDefined();
    expect(outreachSequences.consecutive_non_engagements).toBeDefined();
  });

  it("exports lead_runs with expected columns", () => {
    expect(leadRuns).toBeDefined();
    expect(leadRuns.id).toBeDefined();
    expect(leadRuns.warmup_cap_at_run).toBeDefined();
  });

  it("exports dnc_emails with expected columns", () => {
    expect(dncEmails).toBeDefined();
    expect(dncEmails.id).toBeDefined();
    expect(dncEmails.email).toBeDefined();
    expect(dncEmails.source).toBeDefined();
  });

  it("exports dnc_domains with expected columns", () => {
    expect(dncDomains).toBeDefined();
    expect(dncDomains.id).toBeDefined();
    expect(dncDomains.domain).toBeDefined();
  });

  it("exports resend_warmup_state with expected columns", () => {
    expect(resendWarmupState).toBeDefined();
    expect(resendWarmupState.id).toBeDefined();
    expect(resendWarmupState.daily_cap).toBeDefined();
  });

  it("exports autonomy_state with expected columns", () => {
    expect(autonomyState).toBeDefined();
    expect(autonomyState.track).toBeDefined();
    expect(autonomyState.mode).toBeDefined();
  });
});

describe("LG-1 schema — enum completeness", () => {
  it("candidate email confidence has 3 values", () => {
    expect(CANDIDATE_EMAIL_CONFIDENCES).toEqual([
      "verified",
      "inferred",
      "unknown",
    ]);
  });

  it("candidate sources has 5 values", () => {
    expect(CANDIDATE_SOURCES).toEqual([
      "meta_ad_library",
      "google_maps",
      "google_ads_transparency",
      "manual_brief",
      "manual_entry",
    ]);
  });

  it("candidate tracks has 2 values", () => {
    expect(CANDIDATE_TRACKS).toEqual(["saas", "retainer"]);
  });

  it("outreach touch kinds has 3 values", () => {
    expect(OUTREACH_TOUCH_KINDS).toEqual([
      "first_touch",
      "follow_up",
      "stale_nudge",
    ]);
  });

  it("outreach draft statuses has 6 values", () => {
    expect(OUTREACH_DRAFT_STATUSES).toHaveLength(6);
  });

  it("outreach approval kinds has 3 values", () => {
    expect(OUTREACH_APPROVAL_KINDS).toEqual([
      "manual",
      "auto_send",
      "nudged_manual",
    ]);
  });

  it("outreach bounce kinds has 3 values", () => {
    expect(OUTREACH_BOUNCE_KINDS).toEqual(["hard", "soft", "complaint"]);
  });

  it("outreach sequence statuses has 7 values", () => {
    expect(OUTREACH_SEQUENCE_STATUSES).toHaveLength(7);
  });

  it("lead run triggers has 3 values", () => {
    expect(LEAD_RUN_TRIGGERS).toEqual(["scheduled", "run_now", "manual_brief"]);
  });

  it("DNC email sources has 4 values", () => {
    expect(DNC_EMAIL_SOURCES).toEqual([
      "unsubscribe_link",
      "manual",
      "csv_import",
      "complaint",
    ]);
  });

  it("autonomy modes has 4 values", () => {
    expect(AUTONOMY_MODES).toEqual([
      "manual",
      "probation",
      "auto_send",
      "circuit_broken",
    ]);
  });
});

describe("LG-1 schema — enum extensions to existing tables", () => {
  it("contacts email_status includes 'unsubscribed'", () => {
    expect(CONTACT_EMAIL_STATUSES).toContain("unsubscribed");
  });

  it("activity_log kinds include reactive scoring events", () => {
    expect(ACTIVITY_LOG_KINDS).toContain("candidate_rescored");
    expect(ACTIVITY_LOG_KINDS).toContain("candidate_track_changed");
    expect(ACTIVITY_LOG_KINDS).toContain("candidate_track_change_suppressed");
    expect(ACTIVITY_LOG_KINDS).toContain("candidate_below_floor");
  });

  it("activity_log kinds include original lead gen events", () => {
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_sent");
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_opened");
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_clicked");
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_replied");
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_bounced");
    expect(ACTIVITY_LOG_KINDS).toContain("outreach_unsubscribed");
    expect(ACTIVITY_LOG_KINDS).toContain("sequence_stopped_engagement");
    expect(ACTIVITY_LOG_KINDS).toContain("sequence_stopped_manual");
    expect(ACTIVITY_LOG_KINDS).toContain("autonomy_graduated");
    expect(ACTIVITY_LOG_KINDS).toContain("autonomy_demoted");
  });

  it("scheduled_tasks types include lead gen handlers", () => {
    expect(SCHEDULED_TASK_TYPES).toContain("lead_gen_daily_search");
    expect(SCHEDULED_TASK_TYPES).toContain("sequence_scheduler");
    expect(SCHEDULED_TASK_TYPES).toContain("engagement_tier_evaluator");
    expect(SCHEDULED_TASK_TYPES).toContain("auto_send_execute");
  });
});

describe("LG-1 schema — lead_candidates reactive scoring columns", () => {
  it("has reactive_adjustment column", () => {
    expect(leadCandidates.reactive_adjustment).toBeDefined();
  });

  it("has reactive_adjustment_json column", () => {
    expect(leadCandidates.reactive_adjustment_json).toBeDefined();
  });

  it("has rescored_at column", () => {
    expect(leadCandidates.rescored_at).toBeDefined();
  });

  it("has rescore_count column", () => {
    expect(leadCandidates.rescore_count).toBeDefined();
  });

  it("has below_floor_after_rescore column", () => {
    expect(leadCandidates.below_floor_after_rescore).toBeDefined();
  });

  it("has track_change_used column", () => {
    expect(leadCandidates.track_change_used).toBeDefined();
  });

  it("has previous_track column", () => {
    expect(leadCandidates.previous_track).toBeDefined();
  });

  it("has track_changed_at column", () => {
    expect(leadCandidates.track_changed_at).toBeDefined();
  });
});
