/**
 * SP-1: createDealFromLead() unit tests.
 * Hermetic in-process SQLite; does not touch dev.db.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { createDealFromLead } from "@/lib/crm/create-deal-from-lead";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp1-create-deal.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: ReturnType<typeof drizzle<any>>;

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite);
  drizzleMigrate(db, {
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
  sqlite.exec(
    "DELETE FROM activity_log; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
  );
});

const baseInput = {
  company: { name: "Acme Photography", domain: "https://acme.com.au" },
  contact: { name: "Jane Doe", email: "Jane@ACME.com.au", phone: "+61 400 123 456" },
  source: "lead_gen",
};

describe("createDealFromLead — happy path", () => {
  it("creates a new company, contact, and deal at stage 'lead'", () => {
    const result = createDealFromLead(baseInput, db);
    expect(result.companyReused).toBe(false);
    expect(result.contactReused).toBe(false);
    expect(result.company.name).toBe("Acme Photography");
    expect(result.company.domain).toBe("acme.com.au");
    expect(result.contact.email_normalised).toBe("jane@acme.com.au");
    expect(result.contact.phone_normalised).toBe("61400123456");
    expect(result.deal.stage).toBe("lead");
    expect(result.deal.primary_contact_id).toBe(result.contact.id);
    expect(result.deal.source).toBe("lead_gen");
  });

  it("writes a stage_change activity_log row in the same transaction", () => {
    const result = createDealFromLead(baseInput, db);
    const rows = db
      .select()
      .from(activity_log)
      .where(eq(activity_log.deal_id, result.deal.id))
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("stage_change");
    expect(rows[0].company_id).toBe(result.company.id);
  });
});

describe("createDealFromLead — contact dedupe", () => {
  it("reuses existing contact when email matches (case + domain insensitive)", () => {
    const first = createDealFromLead(baseInput, db);
    const second = createDealFromLead(
      {
        ...baseInput,
        contact: { name: "J. Doe", email: "jane@acme.com.au" },
        source: "intro_funnel_paid",
      },
      db,
    );
    expect(second.contactReused).toBe(true);
    expect(second.contact.id).toBe(first.contact.id);
    expect(second.deal.id).not.toBe(first.deal.id);
  });

  it("falls back to phone match when email missing", () => {
    const first = createDealFromLead(baseInput, db);
    const second = createDealFromLead(
      {
        ...baseInput,
        contact: { name: "Jane D.", phone: "+61 400-123-456" },
        source: "manual",
      },
      db,
    );
    expect(second.contactReused).toBe(true);
    expect(second.contact.id).toBe(first.contact.id);
  });

  it("creates a new contact when email + phone both differ, even within same company", () => {
    const first = createDealFromLead(baseInput, db);
    const second = createDealFromLead(
      {
        ...baseInput,
        contact: {
          name: "Bob Other",
          email: "bob@acme.com.au",
          phone: "+61 411 222 333",
        },
        source: "lead_gen",
      },
      db,
    );
    expect(second.companyReused).toBe(true);
    expect(second.contactReused).toBe(false);
    expect(second.contact.id).not.toBe(first.contact.id);
  });
});

describe("createDealFromLead — non-destructive merge", () => {
  it("never overwrites a populated contact field with null or empty", () => {
    const first = createDealFromLead(
      {
        company: { name: "Beta Studio" },
        contact: {
          name: "Sam Primary",
          role: "Founder",
          email: "sam@beta.studio",
          phone: "+61 400 000 111",
          notes: "Prefers Signal.",
        },
        source: "lead_gen",
      },
      db,
    );
    createDealFromLead(
      {
        company: { name: "Beta Studio", notes: "Wholesale lead" },
        contact: { name: "Sam", email: "sam@beta.studio" },
        source: "lead_gen",
      },
      db,
    );
    const row = db
      .select()
      .from(contacts)
      .where(eq(contacts.id, first.contact.id))
      .get();
    expect(row?.role).toBe("Founder");
    expect(row?.notes).toBe("Prefers Signal.");
    expect(row?.phone_normalised).toBe("61400000111");

    const companyRow = db
      .select()
      .from(companies)
      .where(eq(companies.id, first.company.id))
      .get();
    expect(companyRow?.notes).toBe("Wholesale lead");
  });
});

describe("createDealFromLead — source-driven stage override", () => {
  it("lands deals from intro_funnel_contact_submitted in trial_shoot", () => {
    const result = createDealFromLead(
      { ...baseInput, source: "intro_funnel_contact_submitted" },
      db,
    );
    expect(result.deal.stage).toBe("trial_shoot");
  });

  it("respects an explicit stage override on input", () => {
    const result = createDealFromLead(
      { ...baseInput, stage: "conversation" },
      db,
    );
    expect(result.deal.stage).toBe("conversation");
  });
});

describe("createDealFromLead — company dedupe", () => {
  it("reuses company by normalised name + domain", () => {
    const first = createDealFromLead(baseInput, db);
    const second = createDealFromLead(
      {
        company: { name: "  acme  photography  ", domain: "www.acme.com.au" },
        contact: { name: "New Person", email: "n@elsewhere.test" },
        source: "lead_gen",
      },
      db,
    );
    expect(second.companyReused).toBe(true);
    expect(second.company.id).toBe(first.company.id);
    const all = db.select().from(companies).all();
    expect(all).toHaveLength(1);
  });
});

describe("createDealFromLead — validation", () => {
  it("throws when company.name is blank", () => {
    expect(() =>
      createDealFromLead(
        { ...baseInput, company: { name: "   " } },
        db,
      ),
    ).toThrow(/company\.name/);
  });

  it("throws when contact.name is blank", () => {
    expect(() =>
      createDealFromLead(
        { ...baseInput, contact: { name: "", email: "x@y.z" } },
        db,
      ),
    ).toThrow(/contact\.name/);
  });
});

describe("schema — activity_log FK wiring", () => {
  it("rejects insert with a non-existent company_id", () => {
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO activity_log (id, company_id, kind, body, created_at_ms) VALUES (?, ?, ?, ?, ?)",
        )
        .run("fake1", "does-not-exist", "note", "orphan", Date.now()),
    ).toThrow(/FOREIGN KEY/);
  });

  it("cascade-deletes activity_log rows when a company is deleted", () => {
    const result = createDealFromLead(baseInput, db);
    sqlite
      .prepare("DELETE FROM companies WHERE id = ?")
      .run(result.company.id);
    const rows = db.select().from(activity_log).all();
    expect(rows).toHaveLength(0);
    const remainingDeals = db.select().from(deals).all();
    expect(remainingDeals).toHaveLength(0);
  });
});
