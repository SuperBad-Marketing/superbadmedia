import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { messages, threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { classification_corrections } from "@/lib/db/schema/classification-corrections";
import { RouterOutputSchema } from "@/lib/graph/router";
import { buildRouterPrompt, type RouterPromptContext } from "@/lib/graph/router-prompt";

const TEST_DB = path.join(process.cwd(), "tests/.test-graph-router.db");

let sqlite: Database.Database;
let testDb: ReturnType<typeof drizzle>;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  testDb = drizzle(sqlite);
  const migrationsFolder = path.join(process.cwd(), "lib/db/migrations");
  drizzleMigrate(testDb, { migrationsFolder });
});

afterAll(() => {
  sqlite.close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
});

beforeEach(() => {
  // Clean test data between tests
  sqlite.exec("DELETE FROM classification_corrections");
  sqlite.exec("DELETE FROM messages");
  sqlite.exec("DELETE FROM threads");
  sqlite.exec("DELETE FROM contacts");
  sqlite.exec("DELETE FROM companies");
});

// ── Helpers ──────────────────────────────────────────────────────────

function seedCompany(id = randomUUID()): string {
  sqlite
    .prepare(
      `INSERT INTO companies (id, name, name_normalised, billing_mode, do_not_contact,
        trial_shoot_status, first_seen_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, 'Test Co', 'test co', 'stripe', 0, 'none', ?, ?, ?)`,
    )
    .run(id, Date.now(), Date.now(), Date.now());
  return id;
}

function seedContact(
  companyId: string,
  email = "known@example.com",
  id = randomUUID(),
): string {
  sqlite
    .prepare(
      `INSERT INTO contacts (id, company_id, name, email, email_normalised, email_status,
        is_primary, notification_weight, always_keep_noise, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'Known Person', ?, ?, 'unknown', 1, 0, 0, ?, ?)`,
    )
    .run(id, companyId, email, email.toLowerCase(), Date.now(), Date.now());
  return id;
}

function seedThread(id = randomUUID()): string {
  sqlite
    .prepare(
      `INSERT INTO threads (id, channel_of_origin, priority_class, keep_pinned,
        last_message_at_ms, has_cached_draft, cached_draft_stale, created_at_ms, updated_at_ms)
       VALUES (?, 'email', 'signal', 0, ?, 0, 0, ?, ?)`,
    )
    .run(id, Date.now(), Date.now(), Date.now());
  return id;
}

function seedMessage(threadId: string, id = randomUUID()): string {
  sqlite
    .prepare(
      `INSERT INTO messages (id, thread_id, direction, channel, from_address,
        to_addresses, body_text, priority_class, is_engaged, import_source,
        has_attachments, has_calendar_invite, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'inbound', 'email', 'sender@example.com', '[]', 'test body',
        'signal', 0, 'live', 0, 0, ?, ?)`,
    )
    .run(id, threadId, Date.now(), Date.now());
  return id;
}

// ── RouterOutputSchema tests ─────────────────────────────────────────

describe("RouterOutputSchema — Zod parsing", () => {
  it("parses valid match_existing output", () => {
    const input = {
      classification: "match_existing",
      contact_id: "abc-123",
      new_contact_fields: null,
      detected_alt_email: "alt@example.com",
      reason: "Email matches known contact",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.classification).toBe("match_existing");
    expect(result.contact_id).toBe("abc-123");
    expect(result.detected_alt_email).toBe("alt@example.com");
  });

  it("parses valid new_lead output", () => {
    const input = {
      classification: "new_lead",
      contact_id: null,
      new_contact_fields: {
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@startup.com",
        company_name: "Startup Inc",
        relationship_type: "lead",
        tag: "inbound-photography-enquiry",
      },
      detected_alt_email: null,
      reason: "New business enquiry about photography services",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.classification).toBe("new_lead");
    expect(result.new_contact_fields?.first_name).toBe("Jane");
    expect(result.new_contact_fields?.tag).toBe("inbound-photography-enquiry");
  });

  it("parses valid non_client output with supplier sub-type", () => {
    const input = {
      classification: "non_client",
      contact_id: null,
      new_contact_fields: {
        first_name: "Bob",
        last_name: "Smith",
        email: "bob@printshop.com",
        company_name: "Print Shop",
        relationship_type: "supplier",
        tag: "printing-vendor",
      },
      detected_alt_email: null,
      reason: "Print vendor follow-up",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.classification).toBe("non_client");
    expect(result.new_contact_fields?.relationship_type).toBe("supplier");
  });

  it("parses valid spam output", () => {
    const input = {
      classification: "spam",
      contact_id: null,
      new_contact_fields: null,
      detected_alt_email: null,
      reason: "Unsolicited SEO pitch",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.classification).toBe("spam");
  });

  it("rejects unknown classification", () => {
    const input = {
      classification: "unknown_type",
      contact_id: null,
      new_contact_fields: null,
      reason: "test",
    };
    expect(() => RouterOutputSchema.parse(input)).toThrow();
  });

  it("defaults missing optional fields gracefully", () => {
    const input = {
      classification: "new_lead",
      contact_id: null,
      new_contact_fields: {
        first_name: "Jo",
        email: "jo@example.com",
      },
      reason: "New lead",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.new_contact_fields?.last_name).toBe("");
    expect(result.new_contact_fields?.company_name).toBe("");
    expect(result.new_contact_fields?.relationship_type).toBe("lead");
    expect(result.detected_alt_email).toBeNull();
  });

  it("parses output when LLM omits detected_alt_email field entirely", () => {
    const input = {
      classification: "match_existing",
      contact_id: "xyz",
      new_contact_fields: null,
      reason: "Known contact",
    };
    const result = RouterOutputSchema.parse(input);
    expect(result.detected_alt_email).toBeNull();
  });
});

// ── buildRouterPrompt tests ──────────────────────────────────────────

describe("buildRouterPrompt", () => {
  it("builds prompt with contacts and corrections", () => {
    const ctx: RouterPromptContext = {
      message: {
        id: "msg-1",
        direction: "inbound",
        channel: "email",
        from_address: "new@example.com",
        to_addresses: ["andy@superbadmedia.com.au"],
        cc_addresses: [],
        bcc_addresses: [],
        subject: "Photography enquiry",
        body_text: "Hi, I'd like to discuss a shoot.",
        body_html: null,
        headers: {},
        message_id_header: null,
        in_reply_to_header: null,
        references_header: null,
        sent_at_ms: Date.now(),
        received_at_ms: Date.now(),
        priority_class: "signal",
        noise_subclass: null,
        notification_priority: null,
        router_classification: null,
        router_reason: null,
        is_engaged: false,
        engagement_signals: null,
        import_source: "live",
        has_attachments: false,
        has_calendar_invite: false,
        graph_message_id: "gm-1",
        created_at_ms: Date.now(),
        updated_at_ms: Date.now(),
        internetMessageId: null,
        inReplyTo: null,
        referencesHeader: null,
      },
      contactRows: [
        {
          id: "c-1",
          name: "Alice",
          email: "alice@company.com",
          email_normalised: "alice@company.com",
          company_name: null,
          relationship_type: "client",
          inbox_alt_emails: ["alice.work@company.com"],
        },
      ],
      brandSummary: "Voice: Dry, observational\nTone: dry, honest",
      corrections: [
        {
          from_address: "vendor@example.com",
          subject: "Invoice attached",
          original: "new_lead",
          corrected: "non_client",
        },
      ],
    };

    const prompt = buildRouterPrompt(ctx);
    expect(prompt).toContain("Photography enquiry");
    expect(prompt).toContain("new@example.com");
    expect(prompt).toContain("alice@company.com");
    expect(prompt).toContain("alt: alice.work@company.com");
    expect(prompt).toContain("[client]");
    expect(prompt).toContain("id=c-1");
    expect(prompt).toContain("PREVIOUS CORRECTIONS");
    expect(prompt).toContain("vendor@example.com");
    expect(prompt).toContain("Was: new_lead");
    expect(prompt).toContain("Should be: non_client");
    expect(prompt).toContain("Dry, observational");
  });

  it("builds prompt with no contacts and no corrections", () => {
    const ctx: RouterPromptContext = {
      message: {
        id: "msg-2",
        direction: "inbound",
        channel: "email",
        from_address: "spam@spam.com",
        to_addresses: ["andy@superbadmedia.com.au"],
        cc_addresses: [],
        bcc_addresses: [],
        subject: "Buy now!!!",
        body_text: "Amazing offer just for you!!!",
        body_html: null,
        headers: {},
        message_id_header: null,
        in_reply_to_header: null,
        references_header: null,
        sent_at_ms: Date.now(),
        received_at_ms: Date.now(),
        priority_class: "signal",
        noise_subclass: null,
        notification_priority: null,
        router_classification: null,
        router_reason: null,
        is_engaged: false,
        engagement_signals: null,
        import_source: "live",
        has_attachments: false,
        has_calendar_invite: false,
        graph_message_id: "gm-2",
        created_at_ms: Date.now(),
        updated_at_ms: Date.now(),
        internetMessageId: null,
        inReplyTo: null,
        referencesHeader: null,
      },
      contactRows: [],
      brandSummary: "Voice: Dry",
      corrections: [],
    };

    const prompt = buildRouterPrompt(ctx);
    expect(prompt).toContain("(no contacts yet)");
    expect(prompt).not.toContain("PREVIOUS CORRECTIONS");
    expect(prompt).toContain("spam@spam.com");
  });

  it("truncates body to 2000 chars", () => {
    const longBody = "x".repeat(5000);
    const ctx: RouterPromptContext = {
      message: {
        id: "msg-3",
        direction: "inbound",
        channel: "email",
        from_address: "long@example.com",
        to_addresses: [],
        cc_addresses: [],
        bcc_addresses: [],
        subject: "Long email",
        body_text: longBody,
        body_html: null,
        headers: {},
        message_id_header: null,
        in_reply_to_header: null,
        references_header: null,
        sent_at_ms: Date.now(),
        received_at_ms: Date.now(),
        priority_class: "signal",
        noise_subclass: null,
        notification_priority: null,
        router_classification: null,
        router_reason: null,
        is_engaged: false,
        engagement_signals: null,
        import_source: "live",
        has_attachments: false,
        has_calendar_invite: false,
        graph_message_id: "gm-3",
        created_at_ms: Date.now(),
        updated_at_ms: Date.now(),
        internetMessageId: null,
        inReplyTo: null,
        referencesHeader: null,
      },
      contactRows: [],
      brandSummary: "Voice: Dry",
      corrections: [],
    };

    const prompt = buildRouterPrompt(ctx);
    // Body should be truncated — prompt should not contain the full 5000 chars
    // The prompt includes the body slice plus other text, so check the body
    // section doesn't exceed 2000 chars of repeated x
    expect(prompt).not.toContain("x".repeat(2001));
  });
});

// ── Schema migration tests ───────────────────────────────────────────

describe("classification_corrections table", () => {
  it("allows inserting a correction row", () => {
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const id = randomUUID();

    testDb.insert(classification_corrections).values({
      id,
      message_id: messageId,
      classifier: "router",
      original_classification: "new_lead",
      corrected_classification: "non_client",
      correction_source: "explicit_reroute",
      created_at_ms: Date.now(),
    }).run();

    const row = testDb
      .select()
      .from(classification_corrections)
      .where(eq(classification_corrections.id, id))
      .get();

    expect(row).toBeTruthy();
    expect(row!.classifier).toBe("router");
    expect(row!.original_classification).toBe("new_lead");
    expect(row!.corrected_classification).toBe("non_client");
  });

  it("cascades on message deletion", () => {
    const threadId = seedThread();
    const messageId = seedMessage(threadId);
    const corrId = randomUUID();

    testDb.insert(classification_corrections).values({
      id: corrId,
      message_id: messageId,
      classifier: "notifier",
      original_classification: "silent",
      corrected_classification: "push",
      correction_source: "engagement_implicit",
      created_at_ms: Date.now(),
    }).run();

    // Delete the message — correction should cascade
    testDb.delete(messages).where(eq(messages.id, messageId)).run();
    const row = testDb
      .select()
      .from(classification_corrections)
      .where(eq(classification_corrections.id, corrId))
      .get();
    expect(row).toBeUndefined();
  });
});

describe("contacts inbox columns", () => {
  it("has relationship_type column", () => {
    const companyId = seedCompany();
    const contactId = seedContact(companyId);

    sqlite
      .prepare("UPDATE contacts SET relationship_type = ? WHERE id = ?")
      .run("lead", contactId);

    const row = testDb
      .select({ relationship_type: contacts.relationship_type })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();

    expect(row?.relationship_type).toBe("lead");
  });

  it("has inbox_alt_emails column defaulting to empty array", () => {
    const companyId = seedCompany();
    const contactId = seedContact(companyId);

    const row = testDb
      .select({ inbox_alt_emails: contacts.inbox_alt_emails })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();

    expect(row?.inbox_alt_emails).toEqual([]);
  });

  it("has notification_weight column defaulting to 0", () => {
    const companyId = seedCompany();
    const contactId = seedContact(companyId);

    const row = testDb
      .select({ notification_weight: contacts.notification_weight })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();

    expect(row?.notification_weight).toBe(0);
  });

  it("has always_keep_noise column defaulting to false", () => {
    const companyId = seedCompany();
    const contactId = seedContact(companyId);

    const row = testDb
      .select({ always_keep_noise: contacts.always_keep_noise })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();

    expect(row?.always_keep_noise).toBe(false);
  });

  it("allows updating inbox_alt_emails to a JSON array", () => {
    const companyId = seedCompany();
    const contactId = seedContact(companyId);

    testDb
      .update(contacts)
      .set({ inbox_alt_emails: ["alt1@example.com", "alt2@example.com"] })
      .where(eq(contacts.id, contactId))
      .run();

    const row = testDb
      .select({ inbox_alt_emails: contacts.inbox_alt_emails })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();

    expect(row?.inbox_alt_emails).toEqual(["alt1@example.com", "alt2@example.com"]);
  });
});
