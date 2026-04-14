import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

const {
  listQuoteTemplates,
  createQuoteTemplate,
  updateQuoteTemplate,
  softDeleteQuoteTemplate,
  TemplateValidationError,
} = await import("@/lib/quote-builder/templates");

const TEST_DB = path.join(process.cwd(), "tests/.test-qb2b-templates.db");
let sqlite: Database.Database;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;

beforeAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
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

describe("QB-2b — template CRUD", () => {
  it("creates and reads JSON fields back", () => {
    const row = createQuoteTemplate(
      {
        name: "Starter retainer",
        structure: "retainer",
        term_length_months: 6,
        default_sections: {
          whatWellDo_prose: "Monthly retainer baseline.",
          terms_overrides_prose: "",
        },
        default_line_items: [
          {
            catalogue_item_id: "cat-1",
            qty: 1,
            override_price_cents_inc_gst: null,
            kind: "retainer",
          },
        ],
      },
      db,
    );
    expect(row.name).toBe("Starter retainer");
    expect(row.structure).toBe("retainer");
    expect(row.term_length_months).toBe(6);
    const list = listQuoteTemplates(undefined, db);
    expect(list.length).toBe(1);
    const sections = list[0].default_sections_json as { whatWellDo_prose: string };
    expect(sections.whatWellDo_prose).toBe("Monthly retainer baseline.");
  });

  it("rejects retainer without term length", () => {
    expect(() =>
      createQuoteTemplate(
        {
          name: "Bad",
          structure: "retainer",
          term_length_months: null,
          default_sections: {},
          default_line_items: [],
        },
        db,
      ),
    ).toThrow(TemplateValidationError);
  });

  it("rejects invalid line item qty", () => {
    expect(() =>
      createQuoteTemplate(
        {
          name: "Bad qty",
          structure: "project",
          term_length_months: null,
          default_sections: {},
          default_line_items: [
            {
              catalogue_item_id: "cat-x",
              qty: 0,
              override_price_cents_inc_gst: null,
              kind: "one_off",
            },
          ],
        },
        db,
      ),
    ).toThrow(TemplateValidationError);
  });

  it("soft-delete hides by default, surfaces with flag", () => {
    const row = createQuoteTemplate(
      {
        name: "Trash me",
        structure: "project",
        term_length_months: null,
        default_sections: {},
        default_line_items: [],
      },
      db,
    );
    softDeleteQuoteTemplate(row.id, db);
    const active = listQuoteTemplates(undefined, db);
    expect(active.find((t) => t.id === row.id)).toBeUndefined();
    const all = listQuoteTemplates({ includeDeleted: true }, db);
    expect(all.find((t) => t.id === row.id)).toBeDefined();
  });

  it("refuses to update a deleted row", () => {
    const row = createQuoteTemplate(
      {
        name: "Soon-dead",
        structure: "project",
        term_length_months: null,
        default_sections: {},
        default_line_items: [],
      },
      db,
    );
    softDeleteQuoteTemplate(row.id, db);
    expect(() =>
      updateQuoteTemplate(
        row.id,
        {
          name: "Resurrect",
          structure: "project",
          term_length_months: null,
          default_sections: {},
          default_line_items: [],
        },
        db,
      ),
    ).toThrow(TemplateValidationError);
  });
});
