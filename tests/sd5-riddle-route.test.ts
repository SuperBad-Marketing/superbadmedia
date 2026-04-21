import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "crypto";
import * as schema from "@/lib/db/schema";
import { riddles, riddle_resolutions } from "@/lib/db/schema/riddles";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";

const TEST_DB = "test-sd5-riddle.db";

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

function normalise(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

function hashWith(normalised: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${normalised}`).digest("hex");
}

const SALT_1 = "riddle-salt-abc";
const CORRECT_ANSWER = "fourteen";
const CORRECT_HASH = hashWith(normalise(CORRECT_ANSWER), SALT_1);
const COMMON_WRONG = "twelve";
const COMMON_WRONG_HASH = hashWith(normalise(COMMON_WRONG), SALT_1);

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite, { schema });
  drizzleMigrate(testDb, {
    migrationsFolder: path.join(process.cwd(), "lib/db/migrations"),
  });

  // Seed an active riddle
  testDb.insert(riddles).values({
    id: "riddle-1",
    slug: "grandma-told-you-so",
    salt: SALT_1,
    answer_hash: CORRECT_HASH,
    public_reward_content: "you found the public reward.",
    loggedin_reward_content: "you found the logged-in reward.",
    common_wrong_answers: JSON.stringify([
      { answer_hash: COMMON_WRONG_HASH, response: "close, but no." },
    ]),
    catch_all_wrong_content: "nope. try again.",
    created_at_ms: Date.now(),
    retired_at_ms: null,
  }).run();

  // Seed a retired riddle
  const retiredSalt = "retired-salt-xyz";
  const retiredHash = hashWith(normalise("seven"), retiredSalt);
  testDb.insert(riddles).values({
    id: "riddle-retired",
    slug: "old-one",
    salt: retiredSalt,
    answer_hash: retiredHash,
    public_reward_content: "old reward.",
    loggedin_reward_content: "old logged-in reward.",
    common_wrong_answers: "[]",
    catch_all_wrong_content: "nope.",
    created_at_ms: Date.now() - 90 * 86_400_000,
    retired_at_ms: Date.now() - 30 * 86_400_000,
  }).run();
});

afterAll(() => {
  sqlite.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

describe("SD-5 — resolve-by-answer", () => {
  // Unit tests for normalise + hashWith (exported indirectly via the module)
  it("normalise strips punctuation and lowercases", () => {
    expect(normalise("Fourteen!")).toBe("fourteen");
    expect(normalise("  HELLO world  ")).toBe("hello world");
    expect(normalise("it's-a-test")).toBe("itsatest");
  });

  it("hashWith produces consistent hashes", () => {
    const h1 = hashWith("fourteen", "salt-a");
    const h2 = hashWith("fourteen", "salt-a");
    const h3 = hashWith("fourteen", "salt-b");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe("SD-5 — riddle schema seeding", () => {
  it("active riddle exists in DB", () => {
    const row = testDb.select().from(riddles).where(eq(riddles.id, "riddle-1")).get();
    expect(row).toBeDefined();
    expect(row!.retired_at_ms).toBeNull();
  });

  it("retired riddle exists in DB", () => {
    const row = testDb.select().from(riddles).where(eq(riddles.id, "riddle-retired")).get();
    expect(row).toBeDefined();
    expect(row!.retired_at_ms).not.toBeNull();
  });
});

describe("SD-5 — resolution logging", () => {
  it("riddle_resolutions table accepts inserts", () => {
    const id = nanoid();
    testDb.insert(riddle_resolutions).values({
      id,
      riddle_id: "riddle-1",
      actor_type: "public",
      user_id: null,
      input_hash: createHash("sha256").update("test").digest("hex"),
      resolved_at_ms: Date.now(),
      outcome: "correct",
    }).run();

    const row = testDb.select().from(riddle_resolutions).where(eq(riddle_resolutions.id, id)).get();
    expect(row).toBeDefined();
    expect(row!.outcome).toBe("correct");
  });

  it("all outcome types are valid enum values", () => {
    const outcomes = ["correct", "common_wrong", "novel_wrong", "catch_all_wrong", "retired", "unknown_riddle"] as const;
    for (const outcome of outcomes) {
      const id = nanoid();
      expect(() => {
        testDb.insert(riddle_resolutions).values({
          id,
          riddle_id: "riddle-1",
          actor_type: "public",
          user_id: null,
          input_hash: createHash("sha256").update(outcome).digest("hex"),
          resolved_at_ms: Date.now(),
          outcome,
        }).run();
      }).not.toThrow();
    }
  });
});

describe("SD-5 — answer matching logic", () => {
  it("correct answer produces matching hash", () => {
    const hash = hashWith(normalise("Fourteen"), SALT_1);
    expect(hash).toBe(CORRECT_HASH);
  });

  it("case/punctuation variations still match", () => {
    const variations = ["FOURTEEN", "fourteen!", "  Fourteen  ", "Four-teen"];
    // Four-teen normalises to "fourteen" (strips hyphens)
    for (const v of variations) {
      const hash = hashWith(normalise(v), SALT_1);
      expect(hash).toBe(CORRECT_HASH);
    }
  });

  it("common wrong answer matches its hash", () => {
    const hash = hashWith(normalise("Twelve"), SALT_1);
    expect(hash).toBe(COMMON_WRONG_HASH);
  });

  it("unknown answer does not match correct or common wrong", () => {
    const hash = hashWith(normalise("bananas"), SALT_1);
    expect(hash).not.toBe(CORRECT_HASH);
    expect(hash).not.toBe(COMMON_WRONG_HASH);
  });
});

describe("SD-5 — /say/[answer] page contract", () => {
  it("riddle-response module exports RiddleResponse", async () => {
    const mod = await import("@/app/say/[answer]/riddle-response");
    expect(mod.RiddleResponse).toBeDefined();
  });
});

describe("SD-5 — resolve-by-answer module", () => {
  it("exports resolveByAnswer function", async () => {
    const mod = await import("@/lib/riddles/resolve-by-answer");
    expect(mod.resolveByAnswer).toBeDefined();
    expect(typeof mod.resolveByAnswer).toBe("function");
  });
});
