/**
 * SP-5: trial-shoot sub-machine constants + pure helpers.
 */
import { describe, it, expect } from "vitest";
import {
  TRIAL_SHOOT_SEQUENCE,
  isForwardTransition,
  isTrialShootComplete,
  legalForwardTargets,
} from "@/lib/crm/trial-shoot-status";

describe("trial-shoot-status constants", () => {
  it("locks the 6-state sequence in canonical order", () => {
    expect(TRIAL_SHOOT_SEQUENCE).toEqual([
      "none",
      "booked",
      "planned",
      "in_progress",
      "completed_awaiting_feedback",
      "completed_feedback_provided",
    ]);
  });
});

describe("isForwardTransition", () => {
  it("accepts any strictly-forward move", () => {
    expect(isForwardTransition("none", "booked")).toBe(true);
    expect(isForwardTransition("none", "completed_feedback_provided")).toBe(true);
    expect(isForwardTransition("booked", "in_progress")).toBe(true);
    expect(
      isForwardTransition(
        "completed_awaiting_feedback",
        "completed_feedback_provided",
      ),
    ).toBe(true);
  });

  it("rejects identity", () => {
    for (const s of TRIAL_SHOOT_SEQUENCE) {
      expect(isForwardTransition(s, s)).toBe(false);
    }
  });

  it("rejects every regression", () => {
    expect(isForwardTransition("booked", "none")).toBe(false);
    expect(isForwardTransition("completed_feedback_provided", "in_progress")).toBe(false);
    expect(isForwardTransition("planned", "booked")).toBe(false);
  });
});

describe("isTrialShootComplete", () => {
  it("is true only for completed_* states", () => {
    expect(isTrialShootComplete("completed_awaiting_feedback")).toBe(true);
    expect(isTrialShootComplete("completed_feedback_provided")).toBe(true);
    expect(isTrialShootComplete("none")).toBe(false);
    expect(isTrialShootComplete("booked")).toBe(false);
    expect(isTrialShootComplete("in_progress")).toBe(false);
  });
});

describe("legalForwardTargets", () => {
  it("returns strictly-ahead targets", () => {
    expect(legalForwardTargets("none")).toEqual([
      "booked",
      "planned",
      "in_progress",
      "completed_awaiting_feedback",
      "completed_feedback_provided",
    ]);
    expect(legalForwardTargets("in_progress")).toEqual([
      "completed_awaiting_feedback",
      "completed_feedback_provided",
    ]);
    expect(legalForwardTargets("completed_feedback_provided")).toEqual([]);
  });
});
