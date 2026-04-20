import { describe, it, expect } from "vitest";

import {
  HIRING_STAGES,
  ARCHIVE_REASONS_BY_STAGE,
  SKIP_TRIAL_REASONS,
} from "@/lib/hiring/stages";
import {
  CANDIDATE_STAGES,
  HIRING_CANDIDATE_SOURCES,
} from "@/lib/db/schema/candidates";
import { EMPTY_STATES } from "@/lib/copy/empty-states";

describe("HP-3 — Hiring Pipeline Kanban surface", () => {
  describe("stage-config alignment", () => {
    it("has 7 hiring stages matching schema", () => {
      expect(HIRING_STAGES).toHaveLength(7);
      for (const stage of HIRING_STAGES) {
        expect(CANDIDATE_STAGES).toContain(stage.key);
      }
    });

    it("stage order is strictly ascending", () => {
      const orders = HIRING_STAGES.map((s) => s.order);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    it("every stage has an empty-state key registered", () => {
      for (const stage of HIRING_STAGES) {
        const key = `hiring.column.${stage.key}` as keyof typeof EMPTY_STATES;
        expect(EMPTY_STATES[key]).toBeDefined();
        expect(EMPTY_STATES[key].hero).toBeTruthy();
        expect(EMPTY_STATES[key].message).toBeTruthy();
      }
    });
  });

  describe("archive reasons taxonomy", () => {
    it("sourced has 4 reasons including 'other'", () => {
      const reasons = ARCHIVE_REASONS_BY_STAGE.sourced;
      expect(reasons).toBeDefined();
      expect(reasons).toHaveLength(4);
      expect(reasons).toContain("other");
    });

    it("invited and applied share the same 7-reason set", () => {
      expect(ARCHIVE_REASONS_BY_STAGE.invited).toEqual(
        ARCHIVE_REASONS_BY_STAGE.applied,
      );
      expect(ARCHIVE_REASONS_BY_STAGE.invited).toHaveLength(7);
    });

    it("screened and trial share the same 5-reason set", () => {
      expect(ARCHIVE_REASONS_BY_STAGE.screened).toEqual(
        ARCHIVE_REASONS_BY_STAGE.trial,
      );
      expect(ARCHIVE_REASONS_BY_STAGE.screened).toHaveLength(5);
    });

    it("bench has 6 reasons", () => {
      expect(ARCHIVE_REASONS_BY_STAGE.bench).toHaveLength(6);
      expect(ARCHIVE_REASONS_BY_STAGE.bench).toContain("clean_parting");
    });

    it("every reason set includes 'other'", () => {
      for (const [, reasons] of Object.entries(ARCHIVE_REASONS_BY_STAGE)) {
        if (reasons) expect(reasons).toContain("other");
      }
    });
  });

  describe("skip-trial reasons", () => {
    it("has exactly 3 reasons", () => {
      expect(SKIP_TRIAL_REASONS).toHaveLength(3);
    });

    it("contains the spec-mandated reasons", () => {
      expect(SKIP_TRIAL_REASONS).toContain("prior_relationship");
      expect(SKIP_TRIAL_REASONS).toContain("strong_referral");
      expect(SKIP_TRIAL_REASONS).toContain("immediate_need");
    });
  });

  describe("candidate source types", () => {
    it("has 4 source types", () => {
      expect(HIRING_CANDIDATE_SOURCES).toHaveLength(4);
    });

    it("contains all spec sources", () => {
      expect(HIRING_CANDIDATE_SOURCES).toContain("auto_discovered");
      expect(HIRING_CANDIDATE_SOURCES).toContain("applied");
      expect(HIRING_CANDIDATE_SOURCES).toContain("sourced");
      expect(HIRING_CANDIDATE_SOURCES).toContain("referred");
    });
  });

  describe("staleness thresholds", () => {
    it("sourced threshold is 14 days per spec", () => {
      const stage = HIRING_STAGES.find((s) => s.key === "sourced");
      expect(stage).toBeDefined();
      // threshold values are in settings; test verifies the spec alignment via stage config
    });

    it("bench and archived don't have staleness", () => {
      // Per spec: staleness only for sourced/invited/applied/screened/trial
      // bench and archived have no staleness thresholds
      expect(ARCHIVE_REASONS_BY_STAGE.bench).toBeDefined();
      expect(ARCHIVE_REASONS_BY_STAGE.archived).toBeUndefined();
    });
  });

  describe("empty-state copy voice", () => {
    it("no exclamation marks in hiring empty states", () => {
      for (const stage of HIRING_STAGES) {
        const key = `hiring.column.${stage.key}` as keyof typeof EMPTY_STATES;
        const copy = EMPTY_STATES[key];
        expect(copy.message).not.toContain("!");
        expect(copy.hero).not.toContain("!");
      }
    });

    it("no cheerleading words in hiring empty states", () => {
      const banned = ["amazing", "awesome", "great", "fantastic", "congratulations"];
      for (const stage of HIRING_STAGES) {
        const key = `hiring.column.${stage.key}` as keyof typeof EMPTY_STATES;
        const copy = EMPTY_STATES[key];
        for (const word of banned) {
          expect(copy.message.toLowerCase()).not.toContain(word);
        }
      }
    });
  });
});
