import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  encodeBenchSession,
  decodeBenchSession,
  type BenchSession,
} from "@/lib/bench/guard";

// ---------------------------------------------------------------------------
// Bench session encoding / decoding
// ---------------------------------------------------------------------------

describe("bench session guard", () => {
  const session: BenchSession = {
    candidateId: "cand-abc123",
  };

  it("round-trips encode → decode", () => {
    const encoded = encodeBenchSession(session);
    const decoded = decodeBenchSession(encoded);
    expect(decoded).toEqual(session);
  });

  it("returns null for empty string", () => {
    expect(decodeBenchSession("")).toBeNull();
  });

  it("returns null for invalid base64url", () => {
    expect(decodeBenchSession("not-valid-base64")).toBeNull();
  });

  it("returns null for valid base64url but missing candidateId", () => {
    const raw = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeBenchSession(raw)).toBeNull();
  });

  it("returns null for valid base64url with non-string candidateId", () => {
    const raw = Buffer.from(JSON.stringify({ candidateId: 123 })).toString("base64url");
    expect(decodeBenchSession(raw)).toBeNull();
  });

  it("produces URL-safe base64", () => {
    const encoded = encodeBenchSession(session);
    expect(encoded).not.toMatch(/[+/=]/);
  });
});

// ---------------------------------------------------------------------------
// Wizard definition
// ---------------------------------------------------------------------------

describe("hiring-contractor-onboarding wizard definition", () => {
  it("has expected key and steps", async () => {
    const mod = await import("@/lib/wizards/defs/hiring-contractor-onboarding");
    const wiz = mod.hiringContractorOnboardingWizard;

    expect(wiz.key).toBe("hiring-contractor-onboarding");
    expect(wiz.audience).toBe("client");
    expect(wiz.renderMode).toBe("dedicated-route");
    expect(wiz.steps).toHaveLength(4);
    expect(wiz.steps.map((s) => s.key)).toEqual([
      "abn-legal-name",
      "agreement",
      "bank-details",
      "rate-capacity",
    ]);
  });

  it("completion contract requires all compliance fields", async () => {
    const mod = await import("@/lib/wizards/defs/hiring-contractor-onboarding");
    const wiz = mod.hiringContractorOnboardingWizard;

    const required = wiz.completionContract.required as string[];
    expect(required).toContain("abn");
    expect(required).toContain("legalName");
    expect(required).toContain("agreementSignedAt");
    expect(required).toContain("bankBsb");
    expect(required).toContain("bankAccountNumber");
    expect(required).toContain("bankAccountName");
    expect(required).toContain("hourlyRateAud");
    expect(required).toContain("weeklyCapacityHours");
    expect(required).toContain("onboardingCompletedAt");
  });

  it("logs contractor_onboarding_completed activity on completion", async () => {
    const mod = await import("@/lib/wizards/defs/hiring-contractor-onboarding");
    const wiz = mod.hiringContractorOnboardingWizard;
    expect(wiz.completionContract.artefacts.activityLog).toBe(
      "contractor_onboarding_completed",
    );
  });
});

// ---------------------------------------------------------------------------
// Bench magic link schema exists
// ---------------------------------------------------------------------------

describe("bench-magic-links schema", () => {
  it("exports the table", async () => {
    const mod = await import("@/lib/db/schema/bench-magic-links");
    expect(mod.bench_magic_links).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Email classification
// ---------------------------------------------------------------------------

describe("hiring_contractor_auth transactional classification", () => {
  it("is in the transactional list", async () => {
    const mod = await import("@/lib/channels/email/classifications");
    expect(mod.isTransactional("hiring_contractor_auth")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Activity log kinds
// ---------------------------------------------------------------------------

describe("bench activity log kinds", () => {
  it("includes bench-specific kinds", async () => {
    const mod = await import("@/lib/db/schema/activity-log");
    const kinds = mod.ACTIVITY_LOG_KINDS as readonly string[];
    expect(kinds).toContain("bench_magic_link_sent");
    expect(kinds).toContain("bench_magic_link_redeemed");
    expect(kinds).toContain("contractor_onboarding_completed");
  });
});
