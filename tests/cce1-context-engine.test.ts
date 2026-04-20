import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import { getTableColumns } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = "test-cce1.db";
const NOW = Date.now();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

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

beforeEach(() => {
  testDb.delete(schema.action_items).run();
  testDb.delete(schema.context_summaries).run();
  testDb.delete(schema.llm_usage_log).run();
});

function seedCompany(id = "co_1") {
  testDb
    .insert(schema.companies)
    .values({
      id,
      name: "Test Co",
      name_normalised: "test co",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .onConflictDoNothing()
    .run();
}

function seedContact(id = "ct_1", companyId = "co_1") {
  seedCompany(companyId);
  testDb
    .insert(schema.contacts)
    .values({
      id,
      company_id: companyId,
      name: "Jane Doe",
      preferred_channel: "email",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .onConflictDoNothing()
    .run();
}

describe("context_summaries schema", () => {
  it("has all expected columns", () => {
    const cols = getTableColumns(schema.context_summaries);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("contact_id");
    expect(cols).toHaveProperty("conversation_summary");
    expect(cols).toHaveProperty("summary_generated_at_ms");
    expect(cols).toHaveProperty("draft_content");
    expect(cols).toHaveProperty("draft_channel");
    expect(cols).toHaveProperty("draft_nudge_history");
    expect(cols).toHaveProperty("draft_generated_at_ms");
    expect(cols).toHaveProperty("created_at_ms");
    expect(cols).toHaveProperty("updated_at_ms");
  });

  it("can insert and read a context summary row", () => {
    seedContact();
    testDb
      .insert(schema.context_summaries)
      .values({
        id: "cs_1",
        contact_id: "ct_1",
        conversation_summary: "Test summary",
        summary_generated_at_ms: NOW,
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();

    const row = testDb
      .select()
      .from(schema.context_summaries)
      .get();

    expect(row).toBeDefined();
    expect(row!.contact_id).toBe("ct_1");
    expect(row!.conversation_summary).toBe("Test summary");
  });

  it("enforces unique contact_id constraint", () => {
    seedContact();
    testDb
      .insert(schema.context_summaries)
      .values({
        id: "cs_2",
        contact_id: "ct_1",
        created_at_ms: NOW,
        updated_at_ms: NOW,
      })
      .run();

    expect(() => {
      testDb
        .insert(schema.context_summaries)
        .values({
          id: "cs_3",
          contact_id: "ct_1",
          created_at_ms: NOW,
          updated_at_ms: NOW,
        })
        .run();
    }).toThrow();
  });
});

describe("action_items schema", () => {
  it("has all expected columns", () => {
    const cols = getTableColumns(schema.action_items);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("contact_id");
    expect(cols).toHaveProperty("description");
    expect(cols).toHaveProperty("owner");
    expect(cols).toHaveProperty("due_date_ms");
    expect(cols).toHaveProperty("source");
    expect(cols).toHaveProperty("source_message_id");
    expect(cols).toHaveProperty("status");
    expect(cols).toHaveProperty("created_at_ms");
    expect(cols).toHaveProperty("completed_at_ms");
  });

  it("can insert and read action items", () => {
    seedContact();
    testDb
      .insert(schema.action_items)
      .values({
        id: "ai_1",
        contact_id: "ct_1",
        description: "Send the brief",
        owner: "you",
        source: "manual",
        created_at_ms: NOW,
      })
      .run();

    const row = testDb.select().from(schema.action_items).get();
    expect(row).toBeDefined();
    expect(row!.description).toBe("Send the brief");
    expect(row!.owner).toBe("you");
    expect(row!.status).toBe("open");
  });

  it("defaults status to open", () => {
    seedContact();
    testDb
      .insert(schema.action_items)
      .values({
        id: "ai_2",
        contact_id: "ct_1",
        description: "Follow up",
        owner: "them",
        source: "claude_extract",
        created_at_ms: NOW,
      })
      .run();

    const row = testDb.select().from(schema.action_items).get();
    expect(row!.status).toBe("open");
    expect(row!.completed_at_ms).toBeNull();
  });
});

describe("llm_usage_log schema", () => {
  it("has all expected columns", () => {
    const cols = getTableColumns(schema.llm_usage_log);
    expect(cols).toHaveProperty("id");
    expect(cols).toHaveProperty("call_type");
    expect(cols).toHaveProperty("contact_id");
    expect(cols).toHaveProperty("model");
    expect(cols).toHaveProperty("input_tokens");
    expect(cols).toHaveProperty("output_tokens");
    expect(cols).toHaveProperty("created_at_ms");
  });

  it("can insert and read a usage log entry", () => {
    testDb
      .insert(schema.llm_usage_log)
      .values({
        id: "log_1",
        call_type: "summary_regeneration",
        contact_id: "ct_1",
        model: "haiku",
        input_tokens: 1500,
        output_tokens: 200,
        created_at_ms: NOW,
      })
      .run();

    const row = testDb.select().from(schema.llm_usage_log).get();
    expect(row).toBeDefined();
    expect(row!.call_type).toBe("summary_regeneration");
    expect(row!.input_tokens).toBe(1500);
  });
});

describe("contacts.preferred_channel", () => {
  it("column exists in schema", () => {
    const cols = getTableColumns(schema.contacts);
    expect(cols).toHaveProperty("preferred_channel");
  });

  it("defaults to email", () => {
    seedContact("ct_pref");
    const row = testDb
      .select()
      .from(schema.contacts)
      .where(
        require("drizzle-orm").eq(schema.contacts.id, "ct_pref"),
      )
      .get();
    expect(row!.preferred_channel).toBe("email");
  });
});

describe("module boundary — context-engine does not import private-notes", () => {
  it("assemble.ts has no private_notes import", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "lib/context-engine/assemble.ts"),
      "utf-8",
    );
    expect(content).not.toContain("private-notes");
    expect(content).not.toContain("private_notes");
  });

  it("health.ts has no private_notes import", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "lib/context-engine/health.ts"),
      "utf-8",
    );
    expect(content).not.toContain("private-notes");
    expect(content).not.toContain("private_notes");
  });

  it("signals.ts has no private_notes import", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "lib/context-engine/signals.ts"),
      "utf-8",
    );
    expect(content).not.toContain("private-notes");
    expect(content).not.toContain("private_notes");
  });

  it("action-items.ts has no private_notes import", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "lib/context-engine/action-items.ts"),
      "utf-8",
    );
    expect(content).not.toContain("private-notes");
    expect(content).not.toContain("private_notes");
  });

  it("index.ts barrel does not re-export private-notes", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "lib/context-engine/index.ts"),
      "utf-8",
    );
    expect(content).not.toContain("private-notes");
    expect(content).not.toContain("private_notes");
  });
});

describe("scheduled task types registered", () => {
  it("context_summary_regenerate is a valid task type", () => {
    expect(
      schema.SCHEDULED_TASK_TYPES.includes("context_summary_regenerate"),
    ).toBe(true);
  });

  it("context_action_item_extract is a valid task type", () => {
    expect(
      schema.SCHEDULED_TASK_TYPES.includes("context_action_item_extract"),
    ).toBe(true);
  });
});

describe("activity_log kinds for CCE", () => {
  const cceKinds = [
    "context_summary_regenerated",
    "action_item_extracted",
    "action_item_manual_created",
    "action_item_completed",
    "action_item_dismissed",
    "action_item_edited",
    "draft_generated",
    "draft_nudged",
    "draft_sent",
    "draft_discarded",
    "draft_channel_switched",
  ];

  for (const kind of cceKinds) {
    it(`${kind} is a valid activity_log kind`, () => {
      expect(schema.ACTIVITY_LOG_KINDS.includes(kind as any)).toBe(true);
    });
  }
});
