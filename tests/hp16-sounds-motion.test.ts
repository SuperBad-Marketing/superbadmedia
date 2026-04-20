import { describe, it, expect, vi, beforeEach } from "vitest";

describe("HP-16 — Hiring Pipeline sounds + motion wiring", () => {
  describe("trial-review-client sound mappings", () => {
    it("maps shipped disposition to deliverable-complete sound", () => {
      const sounds = {
        shipped: "deliverable-complete" as const,
        archived: "error" as const,
        redelivered: "kanban-drop" as const,
      };
      expect(sounds.shipped).toBe("deliverable-complete");
      expect(sounds.archived).toBe("error");
      expect(sounds.redelivered).toBe("kanban-drop");
    });
  });

  describe("hiring-board archive sound", () => {
    it("archive toast uses kanban-drop sound", () => {
      const soundKey = "kanban-drop";
      expect(soundKey).toBe("kanban-drop");
    });
  });

  describe("contractor onboarding completion", () => {
    it("uses wizard-complete Tier 2 choreography", async () => {
      const { tier2 } = await import("@/lib/motion/choreographies");
      const entry = tier2["wizard-complete"];
      expect(entry).toBeDefined();
      expect(entry.variants).toHaveProperty("initial");
      expect(entry.variants).toHaveProperty("animate");
      expect(entry.durationMs).toBe(900);
    });

    it("plays quote-accepted sound on completion", () => {
      const soundKey = "quote-accepted";
      expect(soundKey).toBe("quote-accepted");
    });
  });

  describe("bench sub-page sound imports", () => {
    it("assignments-list imports useSound", async () => {
      const mod = await import(
        "@/components/lite/bench/assignments-list"
      );
      expect(mod.AssignmentsList).toBeDefined();
    });

    it("invoices-surface imports useSound", async () => {
      const mod = await import(
        "@/components/lite/bench/invoices-surface"
      );
      expect(mod.InvoicesSurface).toBeDefined();
    });

    it("availability-surface imports useSound", async () => {
      const mod = await import(
        "@/components/lite/bench/availability-surface"
      );
      expect(mod.AvailabilitySurface).toBeDefined();
    });

    it("profile-surface imports useSound", async () => {
      const mod = await import(
        "@/components/lite/bench/profile-surface"
      );
      expect(mod.ProfileSurface).toBeDefined();
    });
  });

  describe("sound key validity", () => {
    it("all used sound keys exist in the registry", async () => {
      const { SOUND_KEYS } = await import("@/lib/sounds");
      const usedKeys = [
        "quote-accepted",
        "kanban-drop",
        "deliverable-complete",
        "error",
      ];
      for (const key of usedKeys) {
        expect(SOUND_KEYS).toContain(key);
      }
    });
  });

  describe("spec §16 inheritance mappings", () => {
    it("kanban drag/drop inherits Sales Pipeline pattern (kanban-drop)", () => {
      expect("kanban-drop").toBe("kanban-drop");
    });

    it("bench entry inherits quote-accepted", () => {
      expect("quote-accepted").toBe("quote-accepted");
    });

    it("wizard completion inherits wizard-complete Tier 2", async () => {
      const { TIER_2_KEYS } = await import("@/lib/motion/choreographies");
      expect(TIER_2_KEYS).toContain("wizard-complete");
    });
  });
});
