import { describe, it, expect } from "vitest";
import {
  ingestPortfolioUrl,
  type PortfolioSignal,
} from "@/lib/hiring/portfolio";
import {
  hiringRoleBriefWizard,
  type HiringRoleBriefPayload,
} from "@/lib/wizards/defs/hiring-role-brief";
import { getWizard, __resetWizardRegistryForTests } from "@/lib/wizards/registry";
import { registerWizard } from "@/lib/wizards/registry";
import { MODELS, type ModelJobSlug } from "@/lib/ai/models";

// ---------------------------------------------------------------------------
// Portfolio ingestion
// ---------------------------------------------------------------------------

describe("ingestPortfolioUrl", () => {
  it("detects Vimeo platform", async () => {
    const result = await ingestPortfolioUrl("https://vimeo.com/user123");
    expect(result.platform).toBe("vimeo");
    expect(result.url).toBe("https://vimeo.com/user123");
    expect(result.fetched_at).toBeGreaterThan(0);
  });

  it("detects Behance platform", async () => {
    const result = await ingestPortfolioUrl("https://behance.net/designer");
    expect(result.platform).toBe("behance");
  });

  it("detects Instagram platform", async () => {
    const result = await ingestPortfolioUrl("https://instagram.com/user");
    expect(result.platform).toBe("instagram");
  });

  it("detects YouTube platform", async () => {
    const result = await ingestPortfolioUrl("https://youtube.com/channel/abc");
    expect(result.platform).toBe("youtube");
  });

  it("detects youtu.be short URLs", async () => {
    const result = await ingestPortfolioUrl("https://youtu.be/abc123");
    expect(result.platform).toBe("youtube");
  });

  it("detects Dribbble platform", async () => {
    const result = await ingestPortfolioUrl("https://dribbble.com/shots/123");
    expect(result.platform).toBe("dribbble");
  });

  it("detects Are.na platform", async () => {
    const result = await ingestPortfolioUrl("https://are.na/user/channel");
    expect(result.platform).toBe("arena");
  });

  it("detects LinkedIn platform", async () => {
    const result = await ingestPortfolioUrl("https://linkedin.com/in/user");
    expect(result.platform).toBe("linkedin");
  });

  it("detects TikTok platform", async () => {
    const result = await ingestPortfolioUrl("https://tiktok.com/@user");
    expect(result.platform).toBe("tiktok");
  });

  it("falls back to personal for unknown domains", async () => {
    const result = await ingestPortfolioUrl("https://janedoe.com/work");
    expect(result.platform).toBe("personal");
  });

  it("returns at least one work sample", async () => {
    const result = await ingestPortfolioUrl("https://example.com");
    expect(result.work_samples.length).toBe(1);
    expect(result.work_samples[0].url).toBe("https://example.com");
  });

  it("returns non-zero confidence for known platforms", async () => {
    const vimeo = await ingestPortfolioUrl("https://vimeo.com/user");
    const personal = await ingestPortfolioUrl("https://janedoe.com");
    expect(vimeo.confidence).toBeGreaterThan(0);
    expect(personal.confidence).toBeGreaterThan(0);
  });

  it("returns valid PortfolioSignal shape", async () => {
    const result = await ingestPortfolioUrl("https://vimeo.com/user");
    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("platform");
    expect(result).toHaveProperty("thumbnails");
    expect(result).toHaveProperty("bio");
    expect(result).toHaveProperty("work_samples");
    expect(result).toHaveProperty("extracted_tags");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("fetched_at");
    expect(Array.isArray(result.thumbnails)).toBe(true);
    expect(Array.isArray(result.work_samples)).toBe(true);
    expect(Array.isArray(result.extracted_tags)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wizard definition
// ---------------------------------------------------------------------------

describe("hiringRoleBriefWizard definition", () => {
  it("has the correct key", () => {
    expect(hiringRoleBriefWizard.key).toBe("hiring-role-brief");
  });

  it("is an admin wizard", () => {
    expect(hiringRoleBriefWizard.audience).toBe("admin");
  });

  it("renders as a dedicated route", () => {
    expect(hiringRoleBriefWizard.renderMode).toBe("dedicated-route");
  });

  it("has 4 steps per spec §6.2", () => {
    expect(hiringRoleBriefWizard.steps).toHaveLength(4);
  });

  it("step order matches spec: basics → references → synthesis → confirm", () => {
    const keys = hiringRoleBriefWizard.steps.map((s) => s.key);
    expect(keys).toEqual([
      "role-basics",
      "reference-portfolios",
      "llm-synthesis",
      "confirm-open",
    ]);
  });

  it("step labels are human-readable", () => {
    const labels = hiringRoleBriefWizard.steps.map((s) => s.label);
    expect(labels).toEqual([
      "Role basics",
      "References",
      "Synthesis",
      "Open role",
    ]);
  });

  it("synthesis step is not resumable (must re-run)", () => {
    const synthesis = hiringRoleBriefWizard.steps.find(
      (s) => s.key === "llm-synthesis",
    );
    expect(synthesis?.resumable).toBe(false);
  });

  it("confirm step uses review-and-confirm type", () => {
    const confirm = hiringRoleBriefWizard.steps.find(
      (s) => s.key === "confirm-open",
    );
    expect(confirm?.type).toBe("review-and-confirm");
  });

  it("completion contract requires essential fields", () => {
    const required = hiringRoleBriefWizard.completionContract.required;
    expect(required).toContain("roleBriefId");
    expect(required).toContain("roleName");
    expect(required).toContain("engagementType");
    expect(required).toContain("referenceUrls");
    expect(required).toContain("styleSummary");
    expect(required).toContain("openedAt");
  });

  it("logs role_brief_opened activity", () => {
    expect(hiringRoleBriefWizard.completionContract.artefacts.activityLog).toBe(
      "role_brief_opened",
    );
  });

  it("has no vendor manifest (not an integration wizard)", () => {
    expect(hiringRoleBriefWizard.vendorManifest).toBeUndefined();
  });

  it("voice treatment has all required tab title pools", () => {
    const pool = hiringRoleBriefWizard.voiceTreatment.tabTitlePool;
    expect(pool.setup.length).toBeGreaterThan(0);
    expect(pool.connecting.length).toBeGreaterThan(0);
    expect(pool.confirming.length).toBeGreaterThan(0);
    expect(pool.connected.length).toBeGreaterThan(0);
    expect(pool.stuck.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Registry registration
// ---------------------------------------------------------------------------

describe("wizard registry integration", () => {
  it("hiring-role-brief is registered", () => {
    const def = getWizard("hiring-role-brief");
    expect(def).toBeDefined();
    expect(def?.key).toBe("hiring-role-brief");
  });

  it("prevents duplicate registration", () => {
    expect(() => registerWizard(hiringRoleBriefWizard)).toThrow(
      /duplicate registration/,
    );
  });
});

// ---------------------------------------------------------------------------
// LLM model registry — hiring jobs
// ---------------------------------------------------------------------------

describe("hiring LLM job slugs", () => {
  const HIRING_JOBS: ModelJobSlug[] = [
    "hiring-brief-synthesize",
    "hiring-discovery-agent",
    "hiring-candidate-score",
    "hiring-invite-draft",
    "hiring-followup-question-draft",
    "hiring-trial-task-author",
    "hiring-portfolio-ingest-vision",
    "hiring-archive-reflection-ingest",
  ];

  it("all 8 hiring jobs are registered", () => {
    for (const job of HIRING_JOBS) {
      expect(MODELS).toHaveProperty(job);
    }
  });

  it("brief-synthesize uses Sonnet", () => {
    expect(MODELS["hiring-brief-synthesize"]).toBe("sonnet");
  });

  it("candidate-score uses Haiku (classification task)", () => {
    expect(MODELS["hiring-candidate-score"]).toBe("haiku");
  });

  it("followup-question-draft uses Haiku (short templated draft)", () => {
    expect(MODELS["hiring-followup-question-draft"]).toBe("haiku");
  });

  it("archive-reflection-ingest uses Haiku", () => {
    expect(MODELS["hiring-archive-reflection-ingest"]).toBe("haiku");
  });
});
