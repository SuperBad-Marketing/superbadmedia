import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate as drizzleMigrate } from "drizzle-orm/better-sqlite3/migrator";

const {
  listCatalogueItems,
  createCatalogueItem,
  updateCatalogueItem,
  softDeleteCatalogueItem,
  restoreCatalogueItem,
  CatalogueValidationError,
} = await import("@/lib/quote-builder/catalogue");

const TEST_DB = path.join(process.cwd(), "tests/.test-qb2b-catalogue.db");
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

describe("QB-2b — catalogue CRUD", () => {
  it("creates, lists, updates and soft-deletes", () => {
    const a = createCatalogueItem(
      {
        name: "Social retainer",
        category: "retainer",
        unit: "month",
        base_price_cents_inc_gst: 350000,
        tier_rank: 2,
        description: null,
      },
      db,
    );
    expect(a.name).toBe("Social retainer");
    expect(a.base_price_cents_inc_gst).toBe(350000);

    const b = createCatalogueItem(
      {
        name: "Brand DNA workshop",
        category: "strategy",
        unit: "project",
        base_price_cents_inc_gst: 150000,
        tier_rank: null,
        description: null,
      },
      db,
    );

    const rows = listCatalogueItems(undefined, db);
    expect(rows.length).toBe(2);

    updateCatalogueItem(
      b.id,
      {
        name: "Brand DNA workshop",
        category: "strategy",
        unit: "project",
        base_price_cents_inc_gst: 175000,
        tier_rank: null,
        description: "One-off intensive",
      },
      db,
    );
    const rowsAfter = listCatalogueItems(undefined, db);
    const updated = rowsAfter.find((r) => r.id === b.id)!;
    expect(updated.base_price_cents_inc_gst).toBe(175000);
    expect(updated.description).toBe("One-off intensive");

    softDeleteCatalogueItem(a.id, db);
    const visible = listCatalogueItems(undefined, db);
    expect(visible.length).toBe(1);
    const all = listCatalogueItems({ includeDeleted: true }, db);
    expect(all.length).toBe(2);

    restoreCatalogueItem(a.id, db);
    expect(listCatalogueItems(undefined, db).length).toBe(2);
  });

  it("rejects invalid inputs", () => {
    expect(() =>
      createCatalogueItem(
        {
          name: "",
          category: "x",
          unit: "project",
          base_price_cents_inc_gst: 100,
          tier_rank: null,
          description: null,
        },
        db,
      ),
    ).toThrow(CatalogueValidationError);
    expect(() =>
      createCatalogueItem(
        {
          name: "ok",
          category: "x",
          unit: "project",
          base_price_cents_inc_gst: -1,
          tier_rank: null,
          description: null,
        },
        db,
      ),
    ).toThrow(CatalogueValidationError);
  });

  it("refuses to update a deleted row", () => {
    const row = createCatalogueItem(
      {
        name: "Temp",
        category: "misc",
        unit: "project",
        base_price_cents_inc_gst: 100,
        tier_rank: null,
        description: null,
      },
      db,
    );
    softDeleteCatalogueItem(row.id, db);
    expect(() =>
      updateCatalogueItem(
        row.id,
        {
          name: "Temp 2",
          category: "misc",
          unit: "project",
          base_price_cents_inc_gst: 100,
          tier_rank: null,
          description: null,
        },
        db,
      ),
    ).toThrow(CatalogueValidationError);
  });
});
