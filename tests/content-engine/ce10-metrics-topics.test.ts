import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn(),
}));

vi.mock("@/lib/content-engine/ranking-snapshot", () => ({
  getPostRankingTrend: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";

// ── Seed keywords ───────────────────────────────────────────────────

describe("seed-keywords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSeedKeywords", () => {
    it("returns empty array when no config exists", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      };

      const { getSeedKeywords } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await getSeedKeywords("company-1", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual([]);
    });

    it("returns empty array when seed_keywords is null", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({ seed_keywords: null }),
              }),
            }),
          }),
        }),
      };

      const { getSeedKeywords } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await getSeedKeywords("company-1", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual([]);
    });

    it("returns seed keywords array when present", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  seed_keywords: ["seo", "marketing"],
                }),
              }),
            }),
          }),
        }),
      };

      const { getSeedKeywords } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await getSeedKeywords("company-1", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual(["seo", "marketing"]);
    });
  });

  describe("addSeedKeyword", () => {
    it("returns no_config when company has no config row", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      };

      const { addSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await addSeedKeyword("company-1", "seo", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: false, reason: "no_config" });
    });

    it("returns already_exists for duplicate keyword (case-insensitive)", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: ["seo", "marketing"],
                }),
              }),
            }),
          }),
        }),
      };

      const { addSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await addSeedKeyword("company-1", "SEO", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: false, reason: "already_exists" });
    });

    it("adds keyword and logs activity on success", async () => {
      const updateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: ["seo"],
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      };

      const { addSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await addSeedKeyword("company-1", "marketing", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: true });
      expect(mockDb.update).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
          kind: "content_seed_keyword_added",
        }),
      );
    });

    it("normalises keyword to lowercase and trimmed", async () => {
      const updateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: [],
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      };

      const { addSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      await addSeedKeyword("company-1", "  Melbourne PHOTOGRAPHY  ", {
        db: mockDb as unknown as typeof db,
      });
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Seed keyword added: "melbourne photography"',
        }),
      );
    });
  });

  describe("removeSeedKeyword", () => {
    it("returns no_config when company has no config row", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue(null),
              }),
            }),
          }),
        }),
      };

      const { removeSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await removeSeedKeyword("company-1", "seo", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: false, reason: "no_config" });
    });

    it("returns not_found when keyword does not exist", async () => {
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: ["seo", "marketing"],
                }),
              }),
            }),
          }),
        }),
      };

      const { removeSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await removeSeedKeyword("company-1", "branding", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("removes keyword and logs activity on success", async () => {
      const updateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: ["seo", "marketing", "branding"],
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      };

      const { removeSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await removeSeedKeyword("company-1", "marketing", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: true });
      expect(mockDb.update).toHaveBeenCalled();
      expect(logActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: "company-1",
          kind: "content_seed_keyword_removed",
          meta: expect.objectContaining({
            keyword: "marketing",
            total: 2,
          }),
        }),
      );
    });

    it("removes case-insensitively", async () => {
      const updateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockDb = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  id: "config-1",
                  seed_keywords: ["SEO", "marketing"],
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: updateSet,
        }),
      };

      const { removeSeedKeyword } = await import(
        "@/lib/content-engine/seed-keywords"
      );
      const result = await removeSeedKeyword("company-1", "seo", {
        db: mockDb as unknown as typeof db,
      });
      expect(result).toEqual({ ok: true });
    });
  });
});
