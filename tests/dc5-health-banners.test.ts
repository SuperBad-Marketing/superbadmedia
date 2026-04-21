import { describe, it, expect, vi, beforeEach } from "vitest";

import type { HealthBanner } from "@/lib/tasks/cockpit";

const MS_PER_DAY = 86_400_000;
const NOW = 1_700_000_000_000;

vi.mock("@/lib/db", () => {
  const selectMock = vi.fn();
  return {
    db: { select: selectMock },
  };
});

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn((key: string) => {
      const map: Record<string, unknown> = {
        "wizards.admin_cockpit_banner_days": 7,
      };
      return Promise.resolve(map[key] ?? null);
    }),
  },
}));

import { db } from "@/lib/db";

function setupSelectChain(rows: unknown[]) {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue(rows),
          get: vi.fn().mockReturnValue(rows[0] ?? null),
        }),
      }),
      leftJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue(rows),
          get: vi.fn().mockReturnValue(rows[0] ?? null),
        }),
      }),
      where: vi.fn().mockReturnValue({
        all: vi.fn().mockReturnValue(rows),
        get: vi.fn().mockReturnValue(rows[0] ?? null),
        groupBy: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue(rows),
        }),
      }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSelectChain([]);
});

// ── Inbox health banners ─────────────────────────────────────────────

describe("getInboxHealthBanners", () => {
  it("returns empty when no issues", async () => {
    const { getInboxHealthBanners } = await import(
      "@/lib/inbox/health-banners"
    );
    const banners = await getInboxHealthBanners(NOW);
    expect(banners).toEqual([]);
  });

  it("returns critical banner for lapsed Graph API subscription", async () => {
    let callCount = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue([
                  { id: "gas-1", subscription_expires_at_ms: NOW - MS_PER_DAY },
                ]),
              }),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([]),
            }),
          }),
        }),
      };
    });

    const { getInboxHealthBanners } = await import(
      "@/lib/inbox/health-banners"
    );
    const banners = await getInboxHealthBanners(NOW);
    const lapsed = banners.find(
      (b: HealthBanner) => b.id === "inbox_graph_api_subscription_lapsed",
    );
    expect(lapsed).toBeDefined();
    expect(lapsed!.severity).toBe("critical");
  });

  it("returns warning banner for stuck import", async () => {
    let callCount = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 3) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([
                { id: "gas-2" },
              ]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              all: vi.fn().mockReturnValue([]),
            }),
          }),
        }),
      };
    });

    const { getInboxHealthBanners } = await import(
      "@/lib/inbox/health-banners"
    );
    const banners = await getInboxHealthBanners(NOW);
    const stuck = banners.find(
      (b: HealthBanner) => b.id === "inbox_import_stuck",
    );
    expect(stuck).toBeDefined();
    expect(stuck!.severity).toBe("warning");
  });
});

// ── Wizard health banners ────────────────────────────────────────────

describe("getWizardHealthBanners", () => {
  it("returns empty when no idle admin wizards", async () => {
    const { getWizardHealthBanners } = await import(
      "@/lib/wizards/health-banners"
    );
    const banners = await getWizardHealthBanners(NOW);
    expect(banners).toEqual([]);
  });

  it("returns warning for wizard idle >7 days", async () => {
    setupSelectChain([
      {
        id: "wp-1",
        wizard_key: "stripe-admin",
        last_active_at_ms: NOW - 10 * MS_PER_DAY,
      },
    ]);

    const { getWizardHealthBanners } = await import(
      "@/lib/wizards/health-banners"
    );
    const banners = await getWizardHealthBanners(NOW);
    expect(banners.length).toBe(1);
    expect(banners[0].id).toBe("wizard_idle:wp-1");
    expect(banners[0].severity).toBe("warning");
    expect(banners[0].summary).toContain("stripe admin");
    expect(banners[0].summary).toContain("10 days");
  });

  it("escalates to critical at 2x threshold", async () => {
    setupSelectChain([
      {
        id: "wp-2",
        wizard_key: "resend",
        last_active_at_ms: NOW - 15 * MS_PER_DAY,
      },
    ]);

    const { getWizardHealthBanners } = await import(
      "@/lib/wizards/health-banners"
    );
    const banners = await getWizardHealthBanners(NOW);
    expect(banners.length).toBe(1);
    expect(banners[0].severity).toBe("critical");
  });
});

// ── Content health banners ───────────────────────────────────────────

describe("getContentHealthBanners", () => {
  it("returns empty when all integrations healthy", async () => {
    setupSelectChain([]);
    const { getContentHealthBanners } = await import(
      "@/lib/content/health-banners"
    );
    const banners = await getContentHealthBanners(NOW);
    expect(banners).toEqual([]);
  });

  it("returns banner for degraded content integration", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: "ic-1", vendor_key: "cloudinary", status: "lapsed" },
          ]),
          get: vi.fn().mockReturnValue(null),
        }),
      }),
    });

    const { getContentHealthBanners } = await import(
      "@/lib/content/health-banners"
    );
    const banners = await getContentHealthBanners(NOW);
    expect(banners.length).toBe(1);
    expect(banners[0].id).toBe("content_integration_degraded");
    expect(banners[0].severity).toBe("warning");
  });

  it("escalates to critical for revoked connections", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { id: "ic-2", vendor_key: "cloudinary", status: "revoked" },
          ]),
          get: vi.fn().mockReturnValue(null),
        }),
      }),
    });

    const { getContentHealthBanners } = await import(
      "@/lib/content/health-banners"
    );
    const banners = await getContentHealthBanners(NOW);
    expect(banners.length).toBe(1);
    expect(banners[0].severity).toBe("critical");
  });
});
