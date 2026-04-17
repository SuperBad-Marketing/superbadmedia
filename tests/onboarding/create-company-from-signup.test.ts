/**
 * OS-1: createCompanyFromSignup() unit tests.
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
import { createCompanyFromSignup } from "@/lib/onboarding/create-company-from-signup";

const TEST_DB = path.join(process.cwd(), "tests/.test-os1-signup.db");
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
  sqlite.exec("DELETE FROM contacts; DELETE FROM companies;");
});

describe("createCompanyFromSignup", () => {
  it("creates company + contact with business name", () => {
    const result = createCompanyFromSignup(
      {
        name: "Jane Doe",
        email: "jane@acme.com",
        businessName: "Acme Studios",
        location: "Melbourne, VIC",
        industry: "creative_media",
      },
      db,
    );

    expect(result.companyId).toBeTruthy();
    expect(result.contactId).toBeTruthy();
    expect(result.companyName).toBe("Acme Studios");

    const co = db.select().from(companies).where(eq(companies.id, result.companyId)).get();
    expect(co).toBeTruthy();
    expect(co!.name).toBe("Acme Studios");
    expect(co!.location).toBe("Melbourne, VIC");
    expect(co!.billing_mode).toBe("stripe");

    const ct = db.select().from(contacts).where(eq(contacts.id, result.contactId)).get();
    expect(ct).toBeTruthy();
    expect(ct!.name).toBe("Jane Doe");
    expect(ct!.email).toBe("jane@acme.com");
    expect(ct!.is_primary).toBe(true);
    expect(ct!.relationship_type).toBe("client");
    expect(ct!.company_id).toBe(result.companyId);
  });

  it("uses customer name as company name for solo operators", () => {
    const result = createCompanyFromSignup(
      {
        name: "Solo Smith",
        email: "solo@example.com",
      },
      db,
    );

    expect(result.companyName).toBe("Solo Smith");

    const co = db.select().from(companies).where(eq(companies.id, result.companyId)).get();
    expect(co!.name).toBe("Solo Smith");
  });

  it("uses customer name when businessName is empty string", () => {
    const result = createCompanyFromSignup(
      {
        name: "Jane Doe",
        email: "jane@example.com",
        businessName: "   ",
      },
      db,
    );

    expect(result.companyName).toBe("Jane Doe");
  });

  it("normalises email to lowercase", () => {
    const result = createCompanyFromSignup(
      {
        name: "Test User",
        email: "Test@EXAMPLE.COM",
      },
      db,
    );

    const ct = db.select().from(contacts).where(eq(contacts.id, result.contactId)).get();
    expect(ct!.email_normalised).toBe("test@example.com");
  });

  it("stores nullable fields as null when not provided", () => {
    const result = createCompanyFromSignup(
      {
        name: "Minimal User",
        email: "minimal@example.com",
      },
      db,
    );

    const co = db.select().from(companies).where(eq(companies.id, result.companyId)).get();
    expect(co!.location).toBeNull();
    expect(co!.industry).toBeNull();
    expect(co!.revenue_range).toBeNull();
    expect(co!.revenue_segmentation_completed_at_ms).toBeNull();

    const ct = db.select().from(contacts).where(eq(contacts.id, result.contactId)).get();
    expect(ct!.phone).toBeNull();
    expect(ct!.onboarding_welcome_seen_at_ms).toBeNull();
  });
});
