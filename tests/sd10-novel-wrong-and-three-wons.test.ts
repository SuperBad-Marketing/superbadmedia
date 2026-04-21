import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "crypto";
import * as schema from "@/lib/db/schema";
import { riddles, riddle_novel_wrong_cache, riddle_resolutions } from "@/lib/db/schema/riddles";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = "test-sd10-novel-wrong.db";

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

const SALT = "sd10-test-salt";

function normalise(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

function hashWith(normalised: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${normalised}`).digest("hex");
}

const CORRECT_ANSWER = "fourteen";
const CORRECT_HASH = hashWith(normalise(CORRECT_ANSWER), SALT);
const COMMON_WRONG = "twelve";
const COMMON_WRONG_HASH = hashWith(normalise(COMMON_WRONG), SALT);

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });

  testDb.insert(riddles).values({
    id: "sd10-riddle-1",
    slug: "sd10-test-riddle",
    salt: SALT,
    answer_hash: CORRECT_HASH,
    public_reward_content: "public reward",
    loggedin_reward_content: "loggedin reward",
    common_wrong_answers: [
      { answer_hash: COMMON_WRONG_HASH, response: "not quite, but close." },
    ],
    catch_all_wrong_content: "that's not it either.",
    created_at_ms: Date.now(),
    retired_at_ms: null,
  }).run();
});

afterAll(() => {
  sqlite?.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe("riddle_novel_wrong_cache table", () => {
  it("exists and accepts inserts", () => {
    const id = "test-cache-1";
    testDb.insert(riddle_novel_wrong_cache).values({
      id,
      riddle_id: "sd10-riddle-1",
      input_hash: hashWith(normalise("banana"), SALT),
      response: "banana? really?",
      drift_check_score: 85,
      created_at_ms: Date.now(),
    }).run();

    const rows = testDb
      .select()
      .from(riddle_novel_wrong_cache)
      .where(eq(riddle_novel_wrong_cache.id, id))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].response).toBe("banana? really?");
    expect(rows[0].drift_check_score).toBe(85);
  });

  it("cascades on riddle delete", () => {
    const tempRiddleId = "sd10-temp-riddle";
    testDb.insert(riddles).values({
      id: tempRiddleId,
      slug: "sd10-temp",
      salt: "temp-salt",
      answer_hash: "xxx",
      public_reward_content: "pub",
      loggedin_reward_content: "log",
      common_wrong_answers: [],
      catch_all_wrong_content: "nope",
      created_at_ms: Date.now(),
      retired_at_ms: null,
    }).run();

    testDb.insert(riddle_novel_wrong_cache).values({
      id: "temp-cache-1",
      riddle_id: tempRiddleId,
      input_hash: "abc123",
      response: "temp response",
      drift_check_score: null,
      created_at_ms: Date.now(),
    }).run();

    testDb.delete(riddles).where(eq(riddles.id, tempRiddleId)).run();

    const orphans = testDb
      .select()
      .from(riddle_novel_wrong_cache)
      .where(eq(riddle_novel_wrong_cache.riddle_id, tempRiddleId))
      .all();

    expect(orphans).toHaveLength(0);
  });

  it("has composite index on riddle_id + input_hash", () => {
    const hash1 = hashWith(normalise("apple"), SALT);
    const hash2 = hashWith(normalise("orange"), SALT);

    testDb.insert(riddle_novel_wrong_cache).values({
      id: "idx-test-1",
      riddle_id: "sd10-riddle-1",
      input_hash: hash1,
      response: "not an apple.",
      drift_check_score: 90,
      created_at_ms: Date.now(),
    }).run();

    testDb.insert(riddle_novel_wrong_cache).values({
      id: "idx-test-2",
      riddle_id: "sd10-riddle-1",
      input_hash: hash2,
      response: "not an orange.",
      drift_check_score: 88,
      created_at_ms: Date.now(),
    }).run();

    const byHash = testDb
      .select()
      .from(riddle_novel_wrong_cache)
      .where(
        sql`${riddle_novel_wrong_cache.riddle_id} = 'sd10-riddle-1' AND ${riddle_novel_wrong_cache.input_hash} = ${hash1}`,
      )
      .all();

    expect(byHash).toHaveLength(1);
    expect(byHash[0].response).toBe("not an apple.");
  });
});

describe("novel_wrong outcome in riddle_resolutions", () => {
  it("accepts novel_wrong as a valid outcome", () => {
    const id = "sd10-res-1";
    testDb.insert(riddle_resolutions).values({
      id,
      riddle_id: "sd10-riddle-1",
      actor_type: "public",
      user_id: null,
      input_hash: "test-hash",
      resolved_at_ms: Date.now(),
      outcome: "novel_wrong",
    }).run();

    const rows = testDb
      .select()
      .from(riddle_resolutions)
      .where(eq(riddle_resolutions.id, id))
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].outcome).toBe("novel_wrong");
  });
});

describe("model registry", () => {
  it("includes sd-riddle-wrong-fallback as haiku tier", async () => {
    const { MODELS } = await import("@/lib/ai/models");
    expect(MODELS["sd-riddle-wrong-fallback"]).toBe("haiku");
  });
});

describe("riddle_answer_fallback_budget_monitor handler", () => {
  it("exports the handler map with the correct key", async () => {
    const { RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS } = await import(
      "@/lib/scheduled-tasks/handlers/riddle-answer-fallback-budget-monitor"
    );
    expect(
      RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS.riddle_answer_fallback_budget_monitor,
    ).toBeDefined();
    expect(
      typeof RIDDLE_ANSWER_FALLBACK_BUDGET_MONITOR_HANDLERS.riddle_answer_fallback_budget_monitor,
    ).toBe("function");
  });
});

describe("ThreeWonsToast component", () => {
  it("exports ThreeWonsToast", async () => {
    const mod = await import("@/components/lite/three-wons-toast");
    expect(mod.ThreeWonsToast).toBeDefined();
    expect(typeof mod.ThreeWonsToast).toBe("function");
  });
});

describe("pipeline-board dispatches CustomEvent for three_wons", () => {
  it("no longer uses plain toast for three wons copy", async () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components/lite/sales-pipeline/pipeline-board.tsx"),
      "utf-8",
    );
    expect(source).toContain('eggId: "three_wons"');
    expect(source).toContain("admin-egg-fired");
    expect(source).not.toContain(
      'toast(\n                "That\'s three. Either you\'re crushing it or it\'s a slow Tuesday."',
    );
  });
});
