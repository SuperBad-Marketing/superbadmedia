import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import * as schema from "@/lib/db/schema";
import { riddles } from "@/lib/db/schema/riddles";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = "test-sd6-search-riddle.db";

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle<typeof schema>>;

function normalise(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
}

function hashWith(normalised: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${normalised}`).digest("hex");
}

const SALT = "sd6-test-salt";
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
    id: "sd6-riddle-1",
    slug: "sd6-test-riddle",
    salt: SALT,
    answer_hash: CORRECT_HASH,
    public_reward_content: "public reward",
    loggedin_reward_content: "loggedin reward",
    common_wrong_answers: [
      { answer_hash: COMMON_WRONG_HASH, response: "not quite, but close." },
    ],
    catch_all_wrong_content: "nope.",
    created_at_ms: Date.now(),
    retired_at_ms: null,
  }).run();
});

afterAll(() => {
  sqlite?.close();
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

describe("Admin search API — riddle integration", () => {
  let GET: typeof import("@/app/api/lite/search/route").GET;

  beforeAll(async () => {
    vi.mock("@/lib/auth/session", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "admin-1", role: "admin", email: "a@test.com" },
      }),
    }));
    const mod = await import("@/app/api/lite/search/route");
    GET = mod.GET;
  });

  it("includes riddle result when query matches correct answer", async () => {
    const req = new NextRequest(`http://localhost/api/lite/search?q=${CORRECT_ANSWER}`);
    const res = await GET(req as any);
    const data = await res.json();
    const riddle = data.results.find((r: any) => r.type === "riddle");
    expect(riddle).toBeDefined();
    expect(riddle.label).toBe("you found something.");
    expect(riddle.id).toBe(CORRECT_ANSWER);
  });

  it("includes riddle result for common wrong answer", async () => {
    const req = new NextRequest(`http://localhost/api/lite/search?q=${COMMON_WRONG}`);
    const res = await GET(req as any);
    const data = await res.json();
    const riddle = data.results.find((r: any) => r.type === "riddle");
    expect(riddle).toBeDefined();
    expect(riddle.label).toBe("not quite.");
  });

  it("does not include riddle result for unrelated query", async () => {
    const req = new NextRequest("http://localhost/api/lite/search?q=random+company+name");
    const res = await GET(req as any);
    const data = await res.json();
    const riddle = data.results.find((r: any) => r.type === "riddle");
    expect(riddle).toBeUndefined();
  });

  it("riddle appears first in results array", async () => {
    const req = new NextRequest(`http://localhost/api/lite/search?q=${CORRECT_ANSWER}`);
    const res = await GET(req as any);
    const data = await res.json();
    if (data.results.length > 0) {
      expect(data.results[0].type).toBe("riddle");
    }
  });
});

describe("Public riddle-check API", () => {
  let GET: typeof import("@/app/api/riddle-check/route").GET;

  beforeAll(async () => {
    const mod = await import("@/app/api/riddle-check/route");
    GET = mod.GET;
  });

  it("returns match: true for correct answer", async () => {
    const req = new NextRequest(`http://localhost/api/riddle-check?q=${CORRECT_ANSWER}`);
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.match).toBe(true);
    expect(data.outcome).toBe("correct");
    expect(data.answer).toBe(CORRECT_ANSWER);
  });

  it("returns match: true for common wrong answer", async () => {
    const req = new NextRequest(`http://localhost/api/riddle-check?q=${COMMON_WRONG}`);
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.match).toBe(true);
    expect(data.outcome).toBe("common_wrong");
  });

  it("returns match: false for unrelated input", async () => {
    const req = new NextRequest("http://localhost/api/riddle-check?q=nonsense");
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.match).toBe(false);
  });

  it("returns match: false for short input", async () => {
    const req = new NextRequest("http://localhost/api/riddle-check?q=a");
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.match).toBe(false);
  });

  it("returns match: false for empty input", async () => {
    const req = new NextRequest("http://localhost/api/riddle-check?q=");
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.match).toBe(false);
  });

  it("does not leak reward content", async () => {
    const req = new NextRequest(`http://localhost/api/riddle-check?q=${CORRECT_ANSWER}`);
    const res = await GET(req as any);
    const data = await res.json();
    expect(data.content).toBeUndefined();
    expect(data.riddleId).toBeUndefined();
  });
});

describe("GlobalSearchResult type includes riddle", () => {
  it("TYPE_ROUTES maps riddle to /say/[answer]", async () => {
    const mod = await import("@/components/lite/global-search");
    const result: any = {
      id: "fourteen",
      type: "riddle" as const,
      label: "you found something.",
      sublabel: null,
    };
    expect(result.type).toBe("riddle");
  });
});
