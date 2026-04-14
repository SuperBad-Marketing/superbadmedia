/**
 * SP-8: `dispatchResendEvent` — `email.complained` branch. Hermetic
 * in-process SQLite.
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
      return database;
    },
  };
});

import { dispatchResendEvent } from "@/lib/resend/webhook-handlers";

const TEST_DB = path.join(process.cwd(), "tests/.test-sp8-complained.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let database: ReturnType<typeof drizzle<any>>;

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

function seed(stage: DealStage, email = "buyer@acme.test") {
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

function makeEvent(email: string) {
  return {
    type: "email.complained",
    data: {
      email_id: `em_${randomUUID()}`,
      to: [email],
      from: "andy@superbadmedia.com.au",
    },
    __svix_id: `svix_${randomUUID()}`,
  };
}

describe("dispatchResendEvent — email.complained", () => {
  it("flags contact, DNC on company, rolls contacted → lead", async () => {
    const { companyId, contactId, dealId } = seed("contacted");
    const ev = makeEvent("buyer@acme.test");
    const outcome = await dispatchResendEvent(ev, { eventId: ev.__svix_id });
    expect(outcome.result).toBe("ok");

    const co = database
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    expect(co?.do_not_contact).toBe(true);

    const c = database
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .get();
    expect(c?.email_status).toBe("complained");

    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("lead");

    const acts = database
      .select()
      .from(activity_log)
      .where(eq(activity_log.company_id, companyId))
      .all();
    expect(acts.some((a) => a.kind === "email_complained")).toBe(true);
  });

  it("also rolls conversation → lead", async () => {
    const { dealId } = seed("conversation");
    const ev = makeEvent("buyer@acme.test");
    await dispatchResendEvent(ev, { eventId: ev.__svix_id });
    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("lead");
  });

  it("leaves deals already past conversation alone", async () => {
    const { dealId, companyId } = seed("quoted");
    const ev = makeEvent("buyer@acme.test");
    await dispatchResendEvent(ev, { eventId: ev.__svix_id });
    const d = database
      .select()
      .from(deals)
      .where(eq(deals.id, dealId))
      .get();
    expect(d?.stage).toBe("quoted");
    // Company still DNC'd.
    const co = database
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .get();
    expect(co?.do_not_contact).toBe(true);
  });

  it("contact not found: skipped + suppression written", async () => {
    const ev = makeEvent("ghost@nowhere.test");
    const outcome = await dispatchResendEvent(ev, { eventId: ev.__svix_id });
    expect(outcome.result).toBe("skipped");
    expect(outcome.error).toBe("contact_not_found");
    const sups = database.select().from(email_suppressions).all();
    expect(sups[0].kind).toBe("complaint");
  });
});
