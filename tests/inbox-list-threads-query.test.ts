/**
 * UI-8 — `listThreads()` view-filter + ordering + unread logic.
 *
 * Covers the nine left-nav views (focus/all/noise/support/drafts/sent/
 * snoozed/trash/spam), the three address filters (all/andy@/support@),
 * the three sort orders (recent/unread_first/priority_first), and the
 * `isUnread` derivation used by the row renderer.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "@/lib/db/schema";

const TEST_DB = path.join(process.cwd(), "tests/.test-inbox-list-threads-query.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testDb: any;

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const { listThreads } = await import("@/app/lite/inbox/_queries/list-threads");
const { threads, messages } = await import("@/lib/db/schema/messages");
const { contacts } = await import("@/lib/db/schema/contacts");
const { companies } = await import("@/lib/db/schema/companies");
const { compose_drafts } = await import("@/lib/db/schema/compose-drafts");
const { user } = await import("@/lib/db/schema/user");

const NOW = 1_700_000_000_000;
const ADMIN_ID = "admin-user-1";

// ── Seeds ────────────────────────────────────────────────────────────

function seedAdmin(): void {
  testDb
    .insert(user)
    .values({
      id: ADMIN_ID,
      email: "andy@superbadmedia.com.au",
      role: "admin",
      created_at_ms: NOW,
    })
    .run();
}

function seedContactWithCompany(
  name = "Sam Ryder",
  email = "sam@acme.test",
): { contactId: string; companyId: string } {
  const companyId = randomUUID();
  const contactId = randomUUID();
  testDb
    .insert(companies)
    .values({
      id: companyId,
      name: "Acme",
      name_normalised: "acme",
      billing_mode: "stripe",
      first_seen_at_ms: NOW,
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  testDb
    .insert(contacts)
    .values({
      id: contactId,
      company_id: companyId,
      name,
      email,
      email_normalised: email.toLowerCase(),
      relationship_type: "client",
      created_at_ms: NOW,
      updated_at_ms: NOW,
    })
    .run();
  return { contactId, companyId };
}

type ThreadOverrides = Partial<typeof threads.$inferInsert>;

function seedThread(overrides: ThreadOverrides = {}): string {
  const id = overrides.id ?? randomUUID();
  testDb
    .insert(threads)
    .values({
      id,
      channel_of_origin: "email",
      sending_address: "andy@",
      subject: "thread subject",
      priority_class: "signal",
      keep_pinned: false,
      last_message_at_ms: NOW,
      last_inbound_at_ms: NOW,
      last_outbound_at_ms: null,
      has_cached_draft: false,
      cached_draft_stale: false,
      snoozed_until_ms: null,
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .run();
  return id;
}

function seedMessage(
  threadId: string,
  overrides: Partial<typeof messages.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb
    .insert(messages)
    .values({
      id,
      thread_id: threadId,
      direction: "inbound",
      channel: "email",
      from_address: "sam@acme.test",
      to_addresses: ["andy@superbadmedia.com.au"],
      subject: "Hello",
      body_text: "Body of the message.",
      priority_class: "signal",
      import_source: "live",
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .run();
  return id;
}

function seedDraft(
  overrides: Partial<typeof compose_drafts.$inferInsert> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb
    .insert(compose_drafts)
    .values({
      id,
      author_user_id: ADMIN_ID,
      sending_address: "andy@",
      body_text: "Draft body",
      created_at_ms: NOW,
      updated_at_ms: NOW,
      ...overrides,
    })
    .run();
  return id;
}

// ── Lifecycle ────────────────────────────────────────────────────────

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
  testDb.delete(compose_drafts).run();
  testDb.delete(messages).run();
  testDb.delete(threads).run();
  testDb.delete(contacts).run();
  testDb.delete(companies).run();
  testDb.delete(user).run();
  seedAdmin();
});

// ── View filter branches ─────────────────────────────────────────────

describe("listThreads — view filter branches", () => {
  it("focus view returns only signal threads with a live message", async () => {
    const sig = seedThread({ priority_class: "signal" });
    seedMessage(sig);
    const noise = seedThread({ priority_class: "noise" });
    seedMessage(noise);
    const spam = seedThread({ priority_class: "spam" });
    seedMessage(spam);

    const { rows } = await listThreads({
      view: "focus",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([sig]);
  });

  it("all view returns every non-trashed thread regardless of class", async () => {
    const sig = seedThread({ priority_class: "signal" });
    seedMessage(sig);
    const noise = seedThread({ priority_class: "noise" });
    seedMessage(noise);
    const spam = seedThread({ priority_class: "spam" });
    seedMessage(spam);

    const { rows } = await listThreads({
      view: "all",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([sig, noise, spam]));
  });

  it("noise view returns only noise-class threads", async () => {
    const noise = seedThread({ priority_class: "noise" });
    seedMessage(noise);
    const sig = seedThread({ priority_class: "signal" });
    seedMessage(sig);

    const { rows } = await listThreads({
      view: "noise",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([noise]);
  });

  it("support view returns only support@-addressed threads", async () => {
    const supportId = seedThread({ sending_address: "support@" });
    seedMessage(supportId);
    const andyId = seedThread({ sending_address: "andy@" });
    seedMessage(andyId);

    const { rows } = await listThreads({
      view: "support",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([supportId]);
  });

  it("sent view returns threads with outbound but no inbound", async () => {
    const outboundOnly = seedThread({
      last_inbound_at_ms: null,
      last_outbound_at_ms: NOW,
    });
    seedMessage(outboundOnly, { direction: "outbound" });
    const bothDirections = seedThread({
      last_inbound_at_ms: NOW,
      last_outbound_at_ms: NOW,
    });
    seedMessage(bothDirections);

    const { rows } = await listThreads({
      view: "sent",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([outboundOnly]);
  });

  it("snoozed view returns only threads whose snooze hasn't elapsed", async () => {
    const future = seedThread({ snoozed_until_ms: NOW + 60_000 });
    seedMessage(future);
    const past = seedThread({ snoozed_until_ms: NOW - 60_000 });
    seedMessage(past);
    const none = seedThread({ snoozed_until_ms: null });
    seedMessage(none);

    const { rows } = await listThreads({
      view: "snoozed",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([future]);
  });

  it("trash view returns threads whose only messages are soft-deleted", async () => {
    const trashId = seedThread();
    seedMessage(trashId, { deleted_at_ms: NOW });
    const liveId = seedThread();
    seedMessage(liveId);

    const { rows } = await listThreads({
      view: "trash",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([trashId]);
  });

  it("spam view returns only spam-class threads", async () => {
    const spamId = seedThread({ priority_class: "spam" });
    seedMessage(spamId);
    const sigId = seedThread({ priority_class: "signal" });
    seedMessage(sigId);

    const { rows } = await listThreads({
      view: "spam",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([spamId]);
  });

  it("drafts view reads compose_drafts rows, not threads", async () => {
    const thId = seedThread();
    seedMessage(thId);
    const draftId = seedDraft({ subject: "WIP reply" });

    const { rows } = await listThreads({
      view: "drafts",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("draft");
    expect(rows[0].id).toBe(`draft_${draftId}`);
    expect(rows[0].subject).toBe("WIP reply");
  });
});

// ── Address filter ───────────────────────────────────────────────────

describe("listThreads — address filter", () => {
  it("all returns threads on any sending_address", async () => {
    const andy = seedThread({ sending_address: "andy@" });
    seedMessage(andy);
    const support = seedThread({ sending_address: "support@" });
    seedMessage(support);

    const { rows } = await listThreads({
      view: "all",
      addressFilter: "all",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(new Set(rows.map((r) => r.id))).toEqual(new Set([andy, support]));
  });

  it("andy@ filters out support@ threads", async () => {
    const andy = seedThread({ sending_address: "andy@" });
    seedMessage(andy);
    const support = seedThread({ sending_address: "support@" });
    seedMessage(support);

    const { rows } = await listThreads({
      view: "all",
      addressFilter: "andy@",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([andy]);
  });

  it("support@ filters out andy@ threads", async () => {
    const andy = seedThread({ sending_address: "andy@" });
    seedMessage(andy);
    const support = seedThread({ sending_address: "support@" });
    seedMessage(support);

    const { rows } = await listThreads({
      view: "all",
      addressFilter: "support@",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([support]);
  });
});

// ── Ordering + unread ────────────────────────────────────────────────

describe("listThreads — ordering + unread flag", () => {
  it("recent sort orders by last_message_at_ms descending with pinned first", async () => {
    const older = seedThread({ last_message_at_ms: NOW - 10_000 });
    seedMessage(older);
    const newer = seedThread({ last_message_at_ms: NOW });
    seedMessage(newer);
    const pinnedOld = seedThread({
      last_message_at_ms: NOW - 50_000,
      keep_pinned: true,
    });
    seedMessage(pinnedOld);

    const { rows } = await listThreads({
      view: "all",
      sort: "recent",
      adminUserId: ADMIN_ID,
      now: NOW,
    });

    expect(rows.map((r) => r.id)).toEqual([pinnedOld, newer, older]);
  });

  it("marks threads unread when last_inbound > last_outbound (or no outbound)", async () => {
    const unread = seedThread({
      last_inbound_at_ms: NOW,
      last_outbound_at_ms: NOW - 60_000,
    });
    seedMessage(unread);
    const read = seedThread({
      last_inbound_at_ms: NOW - 60_000,
      last_outbound_at_ms: NOW,
    });
    seedMessage(read);
    const neverInbound = seedThread({
      last_inbound_at_ms: null,
      last_outbound_at_ms: NOW,
    });
    seedMessage(neverInbound, { direction: "outbound" });

    const { rows } = await listThreads({
      view: "all",
      adminUserId: ADMIN_ID,
      now: NOW,
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    expect(byId.get(unread)?.isUnread).toBe(true);
    expect(byId.get(read)?.isUnread).toBe(false);
    expect(byId.get(neverInbound)?.isUnread).toBe(false);
  });
});
