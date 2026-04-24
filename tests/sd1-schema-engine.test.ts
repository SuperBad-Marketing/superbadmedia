import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import fs from "node:fs";
import path from "node:path";

import {
  ALL_EGGS,
  ADMIN_EGGS,
  PUBLIC_EGGS,
  getEggById,
  getEggsForRegister,
  getRegisterForActorType,
} from "@/lib/eggs/registry";
import { isSuppressed, type SuppressionContext } from "@/lib/eggs/suppression";
import {
  canFireAuthenticatedEgg,
  canFirePublicEgg,
  updateFiredEggIds,
  type CadenceState,
  type PublicCadenceState,
} from "@/lib/eggs/cadence";
import {
  registerTrigger,
  evaluateAllTriggers,
  type TriggerContext,
} from "@/lib/eggs/trigger-evaluator";
import {
  generateInVoice,
} from "@/lib/eggs/generate-in-voice";
import { killSwitches, resetKillSwitchesToDefaults } from "@/lib/kill-switches";
import { AMBIENT_SLOTS } from "@/lib/db/schema/ambient-copy-cache";
import { RIDDLE_OUTCOMES } from "@/lib/db/schema/riddles";

const TEST_DB = "test-sd1.db";
const NOW = Date.now();
const MS_PER_DAY = 86_400_000;

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("SD-1 Schema", () => {
  it("creates hidden_egg_fires table", () => {
    const row = testDb
      .insert(schema.hidden_egg_fires)
      .values({
        id: "hef_1",
        egg_id: "crt_turn_off",
        actor_type: "admin",
        fired_at_ms: NOW,
        trigger_evidence: { late_nights: 3 },
        session_id: "sess_1",
      })
      .returning()
      .get();
    expect(row.egg_id).toBe("crt_turn_off");
    expect(row.actor_type).toBe("admin");
  });

  it("creates ambient_copy_cache table", () => {
    const row = testDb
      .insert(schema.ambient_copy_cache)
      .values({
        id: "acc_1",
        slot: "empty_state",
        context_hash: "abc123",
        generated_text: "no prospects yet. that's either a problem or a really good week.",
        drift_check_score: 85,
        generated_at_ms: NOW,
      })
      .returning()
      .get();
    expect(row.slot).toBe("empty_state");
    expect(row.generated_text).toContain("no prospects yet");
  });

  it("creates riddles table with common_wrong_answers JSON", () => {
    const commonWrongs = [
      { answer_hash: "hash1", response: "nope." },
      { answer_hash: "hash2", response: "not even close." },
    ];
    const row = testDb
      .insert(schema.riddles)
      .values({
        id: "riddle_1",
        slug: "test-riddle",
        salt: "salt123",
        answer_hash: "correcthash",
        public_reward_content: "you found it.",
        loggedin_reward_content: "you found it, and you're logged in.",
        common_wrong_answers: commonWrongs,
        catch_all_wrong_content: "that's not it.",
        created_at_ms: NOW,
      })
      .returning()
      .get();
    expect(row.slug).toBe("test-riddle");
    expect(row.common_wrong_answers).toEqual(commonWrongs);
  });

  it("creates riddle_resolutions with cascade on riddle delete", () => {
    testDb
      .insert(schema.riddle_resolutions)
      .values({
        id: "rr_1",
        riddle_id: "riddle_1",
        actor_type: "public",
        input_hash: "inputhash",
        resolved_at_ms: NOW,
        outcome: "correct",
      })
      .run();

    const rows = testDb.select().from(schema.riddle_resolutions).all();
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("user table has new S&D columns", () => {
    testDb
      .insert(schema.user)
      .values({
        id: "user_sd_test",
        email: "sd@test.com",
        created_at_ms: NOW,
        hidden_egg_tricks_enabled: true,
        fired_egg_ids_recent: [],
      })
      .run();
    const rows = testDb.select().from(schema.user).all();
    const row = rows.find((u) => u.id === "user_sd_test");
    expect(row?.hidden_egg_tricks_enabled).toBe(true);
    expect(row?.fired_egg_ids_recent).toEqual([]);
    expect(row?.last_hidden_egg_fired_at_ms).toBeNull();
  });
});

describe("Egg Registry", () => {
  it("has 6 admin eggs", () => {
    expect(ADMIN_EGGS).toHaveLength(6);
  });

  it("has 12 public eggs", () => {
    expect(PUBLIC_EGGS).toHaveLength(12);
  });

  it("ALL_EGGS = admin + public", () => {
    expect(ALL_EGGS).toHaveLength(18);
  });

  it("getEggById finds by id", () => {
    expect(getEggById("crt_turn_off")?.name).toBe("CRT Turn-Off");
    expect(getEggById("nonexistent")).toBeUndefined();
  });

  it("getEggsForRegister filters correctly", () => {
    const adminEggs = getEggsForRegister("admin-roommate");
    expect(adminEggs.every((e) => e.register === "admin-roommate")).toBe(true);
  });

  it("getRegisterForActorType maps correctly", () => {
    expect(getRegisterForActorType("admin")).toBe("admin-roommate");
    expect(getRegisterForActorType("customer")).toBe("customer-bartender");
    expect(getRegisterForActorType("public")).toBe("public-bartender");
  });
});

describe("Suppression", () => {
  const base: SuppressionContext = {
    isPaymentElementMounted: false,
    isEmailComposeFocused: false,
    isQuoteAcceptanceFlow: false,
    isErrorPage: false,
    isOnboardingWizard: false,
    isFirstEverLogin: false,
    sessionAgeMs: 60_000,
  };

  it("allows when no suppression active", () => {
    expect(isSuppressed(base)).toBe(false);
  });

  it("suppresses during payment", () => {
    expect(isSuppressed({ ...base, isPaymentElementMounted: true })).toBe(true);
  });

  it("suppresses during email compose", () => {
    expect(isSuppressed({ ...base, isEmailComposeFocused: true })).toBe(true);
  });

  it("suppresses during quote acceptance", () => {
    expect(isSuppressed({ ...base, isQuoteAcceptanceFlow: true })).toBe(true);
  });

  it("suppresses on error pages", () => {
    expect(isSuppressed({ ...base, isErrorPage: true })).toBe(true);
  });

  it("suppresses during onboarding wizard", () => {
    expect(isSuppressed({ ...base, isOnboardingWizard: true })).toBe(true);
  });

  it("suppresses on first-ever login", () => {
    expect(isSuppressed({ ...base, isFirstEverLogin: true })).toBe(true);
  });

  it("suppresses in first 30 seconds", () => {
    expect(isSuppressed({ ...base, sessionAgeMs: 10_000 })).toBe(true);
  });
});

describe("Cadence", () => {
  const egg = getEggById("crt_turn_off")!;
  const exemptEgg = getEggById("melbourne_public_holiday")!;

  it("allows fire when no prior fires", () => {
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: null,
      firedEggIdsRecent: [],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(true);
  });

  it("blocks fire within cadence window", () => {
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 3 * MS_PER_DAY,
      firedEggIdsRecent: [],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(false);
  });

  it("allows fire after cadence window expires", () => {
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 10 * MS_PER_DAY,
      firedEggIdsRecent: [],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(true);
  });

  it("blocks fire when tricks disabled", () => {
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: null,
      firedEggIdsRecent: [],
      tricksEnabled: false,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(false);
  });

  it("blocks egg already in recent list", () => {
    const state: CadenceState = {
      actorType: "admin",
      lastHiddenEggFiredAtMs: NOW - 10 * MS_PER_DAY,
      firedEggIdsRecent: ["crt_turn_off"],
      tricksEnabled: true,
    };
    expect(canFireAuthenticatedEgg(egg, state, NOW, 7)).toBe(false);
  });

  it("public: allows first egg always", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: false,
    };
    expect(canFirePublicEgg(egg, state, NOW, 14)).toBe(true);
  });

  it("public: exempt eggs bypass budget", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: NOW - MS_PER_DAY,
      lastHiddenEggFiredAt: NOW - MS_PER_DAY,
      firedEggIds: ["a", "b"],
      tricksDisabled: false,
    };
    expect(canFirePublicEgg(exemptEgg, state, NOW, 14)).toBe(true);
  });

  it("public: blocks when tricks disabled", () => {
    const state: PublicCadenceState = {
      firstEggDeliveredAt: null,
      lastHiddenEggFiredAt: null,
      firedEggIds: [],
      tricksDisabled: true,
    };
    expect(canFirePublicEgg(egg, state, NOW, 14)).toBe(false);
  });

  it("updateFiredEggIds caps at maxEntries", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `egg_${i}`);
    const result = updateFiredEggIds(ids, "egg_50", 50);
    expect(result).toHaveLength(50);
    expect(result[49]).toBe("egg_50");
    expect(result[0]).toBe("egg_1");
  });
});

describe("Trigger Evaluator", () => {
  it("registers and evaluates triggers", () => {
    registerTrigger("test_egg", (ctx) => {
      if (ctx.localHour >= 2 && ctx.localHour < 5) {
        return { local_hour: ctx.localHour };
      }
      return null;
    });

    const ctx: TriggerContext = {
      nowMs: NOW,
      localHour: 3,
      dayOfWeek: 0,
      referrer: "",
      dwellMs: 0,
      scrollDepth: 0,
      scrollDurationMs: 0,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "sess_1",
      isMobile: false,
    };

    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "test_egg");
    expect(match).toBeDefined();
    expect(match!.evidence).toEqual({ local_hour: 3 });
  });

  it("returns no evidence when trigger does not match", () => {
    const ctx: TriggerContext = {
      nowMs: NOW,
      localHour: 12,
      dayOfWeek: 3,
      referrer: "",
      dwellMs: 0,
      scrollDepth: 0,
      scrollDurationMs: 0,
      tabBackgroundedMs: 0,
      timezone: "Australia/Melbourne",
      visitCount: 1,
      sessionId: "sess_2",
      isMobile: false,
    };

    const results = evaluateAllTriggers(ctx);
    const match = results.find((r) => r.eggId === "test_egg");
    expect(match).toBeUndefined();
  });
});

describe("generateInVoice stub", () => {
  afterAll(() => resetKillSwitchesToDefaults());

  it("returns placeholder text", async () => {
    killSwitches.llm_calls_enabled = false;
    const result = await generateInVoice({
      slot: "empty_state",
      context: { page: "pipeline" },
    });
    expect(result.text).toContain("voice placeholder");
    expect(result.passedDriftCheck).toBe(true);
  });
});

describe("Ambient slots", () => {
  it("has 6 closed-list categories", () => {
    expect(AMBIENT_SLOTS).toHaveLength(6);
    expect(AMBIENT_SLOTS).toContain("empty_state");
    expect(AMBIENT_SLOTS).toContain("error_page");
    expect(AMBIENT_SLOTS).toContain("loading_copy");
    expect(AMBIENT_SLOTS).toContain("success_toast");
    expect(AMBIENT_SLOTS).toContain("placeholder_text");
    expect(AMBIENT_SLOTS).toContain("morning_brief_narrative");
  });
});

describe("Riddle outcomes", () => {
  it("has 6 outcome types", () => {
    expect(RIDDLE_OUTCOMES).toHaveLength(6);
  });
});
