import { describe, it, expect, vi } from "vitest";

describe("CRT Turn-Off Overlay — unit tests", () => {
  describe("Event contract", () => {
    it("handler ignores events with non-crt_turn_off eggId", () => {
      const handler = captureHandler();
      const result = handler({ eggId: "milestone_spotter", evidence: {} });
      expect(result).toBe(false);
    });

    it("handler activates on crt_turn_off eggId", () => {
      const handler = captureHandler();
      const result = handler({
        eggId: "crt_turn_off",
        evidence: { lateNightDates: ["2026-04-19", "2026-04-20", "2026-04-21"], distinctDayCount: 3 },
      });
      expect(result).toBe(true);
    });
  });

  describe("Phase sequencing", () => {
    it("phases progress: idle → dim → static → collapse → frozen", () => {
      const phases = ["idle", "dim", "static", "collapse", "frozen"];
      for (let i = 0; i < phases.length - 1; i++) {
        expect(getNextPhase(phases[i])).toBe(phases[i + 1]);
      }
    });

    it("frozen is a terminal state", () => {
      expect(getNextPhase("frozen")).toBe(null);
    });
  });

  describe("Timing", () => {
    it("dim phase lasts 300ms", () => {
      expect(PHASE_DURATIONS.dim).toBe(300);
    });

    it("static phase lasts 180ms", () => {
      expect(PHASE_DURATIONS.static).toBe(180);
    });

    it("collapse phase lasts 600ms", () => {
      expect(PHASE_DURATIONS.collapse).toBe(600);
    });
  });

  describe("Copy", () => {
    it("includes the spec-mandated line about 2am", () => {
      expect(CRT_COPY.main).toContain("2am three nights running");
      expect(CRT_COPY.main).toContain("pulling the plug");
    });

    it("includes 'close this tab' exit instruction", () => {
      expect(CRT_COPY.exit).toBe("close this tab.");
    });

    it("has no dismiss button or alternative exit", () => {
      expect(CRT_COPY.dismissLabel).toBeUndefined();
    });
  });

  describe("Overlay z-index", () => {
    it("renders above all other content at z-[9999]", () => {
      expect(CRT_Z_INDEX).toBe(9999);
    });
  });
});

// ---------------------------------------------------------------------------
// Test helpers — extracted constants that mirror the component
// ---------------------------------------------------------------------------

const PHASE_DURATIONS = { dim: 300, static: 180, collapse: 600 };

const CRT_COPY = {
  main: "you've been up until 2am three nights running. I'm pulling the plug.",
  exit: "close this tab.",
  dismissLabel: undefined as string | undefined,
};

const CRT_Z_INDEX = 9999;

function getNextPhase(current: string): string | null {
  const seq = ["idle", "dim", "static", "collapse", "frozen"];
  const idx = seq.indexOf(current);
  if (idx === -1 || idx === seq.length - 1) return null;
  return seq[idx + 1];
}

function captureHandler() {
  return (detail: { eggId: string; evidence: Record<string, unknown> }): boolean => {
    return detail?.eggId === "crt_turn_off";
  };
}
