/**
 * SP-8: `dispatchResendEvent` — `email.bounced` branch. Hermetic
 * in-process SQLite; settings.get is mocked to kill-switch = true.
 */
import fs from "node:fs";
import path from "node:path";
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
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals, type DealStage } from "@/lib/db/schema/deals";
import { activity_log } from "@/lib/db/schema/activity-log";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn(async (key: string) => {
      if (key === "pipeline.resend_webhook_dispatch_enabled") return true;
      throw new Error(`Unexpected settings key: ${key}`);
    }),
  },
}));

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return getDb();
    },
  };
});

import { dispatchResendEvent } from "@/lib/resend/webhook-handlers";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp8-bounced.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let database: ReturnType<typeof drizzle<any>>;

function getDb() {
  return database;
}

beforeAll(() => {
  for (const ext of ["", "-wal", "-shm"]) {
    const p = `${TEST_DB}${ext}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  sqlite = new Database(TEST_DB);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  database = drizzle(sqlite);
  drizzleMigrate(database, {
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
    "DELETE FROM activity_log; DELETE FROM email_suppressions; DELETE FROM deals; DELETE FROM contacts; DELETE FROM companies;",
  );
});

function seed(stage: DealStage, email = "buyer@acme.test"): {
  companyId: string;
  contactId: string;
  dealId: string;
} {
  const nowMs = 1_700_000_000_000;
  const companyId = randomUUID();
  const contactId = randomUUID();
  const dealId = randomUUID();
  database.insert(companies).values({
    id: companyId,
    name: "Acme",
    name_normalised: "acme",
    billing_mode: "stripe",
    do_not_contact: false,
    trial_shoot_status: "none",
    first_seen_at_ms: nowMs,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  }).run();
  database.insert(contacts).values({
    id: contactId,
    company_id: companyId,
    name: "Buyer",
    email,
    email_normalised: email.toLowerCase(),
    email_status: "valid",
    is_primary: true,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  }).run();
  database.insert(deals).values({
    id: dealId,
    company_id: companyId,
    primary_contact_id: contactId,
    title: "Acme deal",
    stage,
    value_estimated: true,
    pause_used_this_commitment: false,
    last_stage_change_at_ms: nowMs,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  }).run();
  return { companyId, contactId, dealId };
}

function makeEvent(
  email: string,
  type: "hard" | "soft",
  eventId = `svix_${randomUUID()}`,
) {
  return {
    type: "email.bounced",
    data: {
      email_id: `em_${randomUUID()}`,
      to: [email],
      from: "andy@superbadmedia.com.au",
      subject: "Hi",
      bounce: { type, message: "test" },
    },
    __svix_id: eventId,
  };
}

describe("dispatchResendEvent — email.bounced", () => {
  it("hard bounce: flags contact invalid, suppresses, rolls Contacted → Lead", async () => {
    const { contactId, dealId, companyId } = seed("contacted");
    const ev = makeEvent("buyer@acme.test", "hard");
    const outcome = await dispatchResendEvent(ev, {
      eventId: ev.__svix_id,
    });
    expect(outcome.result).toBe("ok");

    const c = database
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();
    expect(c?.email_status).toBe("invalid");

    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("lead");

    const sups = database.select().from(email_suppressions).all();
    expect(sups.length).toBe(1);
    expect(sups[0].kind).toBe("bounce");

    const acts = database
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    expect(acts.map((a) => a.kind).sort()).toEqual([
      "email_bounced",
      "stage_change",
    ]);
  });

  it("hard bounce: does NOT roll back when deal moved past contacted", async () => {
    const { contactId, dealId } = seed("quoted");
    const ev = makeEvent("buyer@acme.test", "hard");
    const outcome = await dispatchResendEvent(ev, {
      eventId: ev.__svix_id,
    });
    expect(outcome.result).toBe("ok");
    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("quoted");
    const c = database
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();
    expect(c?.email_status).toBe("invalid");
  });

  it("soft bounce: flags soft_bounce, no rollback", async () => {
    const { contactId, dealId } = seed("contacted");
    const ev = makeEvent("buyer@acme.test", "soft");
    const outcome = await dispatchResendEvent(ev, {
      eventId: ev.__svix_id,
    });
    expect(outcome.result).toBe("ok");
    const c = database
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();
    expect(c?.email_status).toBe("soft_bounce");
    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("contacted");
  });

  it("contact not found: records suppression + returns skipped:contact_not_found", async () => {
    const ev = makeEvent("ghost@nowhere.test", "hard");
    const outcome = await dispatchResendEvent(ev, {
      eventId: ev.__svix_id,
    });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("contact_not_found");
    const sups = database.select().from(email_suppressions).all();
    expect(sups.length).toBe(1);
  });

  it("missing recipient: error:missing_recipient", async () => {
    const ev = {
      type: "email.bounced",
      data: { bounce: { type: "hard" } },
      __svix_id: `svix_${randomUUID()}`,
    };
    const outcome = await dispatchResendEvent(ev, {
      eventId: ev.__svix_id,
    });
    expect(outcome.result).toBe("error");
    expect(outcome.error).toBe("missing_recipient");
  });
});
