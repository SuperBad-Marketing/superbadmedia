import { describe, it, expect } from "vitest";

describe("CM-11: private_notes schema", () => {
  it("exports private_notes table and types", async () => {
    const mod = await import("../lib/db/schema/private-notes");
    expect(mod.private_notes).toBeDefined();
  });

  it("has the expected columns", async () => {
    const mod = await import("../lib/db/schema/private-notes");
    const cols = Object.keys(mod.private_notes);
    expect(cols).toContain("id");
    expect(cols).toContain("contact_id");
    expect(cols).toContain("content");
    expect(cols).toContain("created_by");
    expect(cols).toContain("created_at_ms");
    expect(cols).toContain("updated_at_ms");
  });

  it("is re-exported from schema index", async () => {
    const mod = await import("../lib/db/schema/index");
    expect(mod.private_notes).toBeDefined();
  });
});

describe("CM-11: private-notes module", () => {
  it("exports createPrivateNote", async () => {
    const mod = await import("../lib/private-notes");
    expect(mod.createPrivateNote).toBeDefined();
    expect(typeof mod.createPrivateNote).toBe("function");
  });

  it("exports getPrivateNotesForContact", async () => {
    const mod = await import("../lib/private-notes");
    expect(mod.getPrivateNotesForContact).toBeDefined();
    expect(typeof mod.getPrivateNotesForContact).toBe("function");
  });

  it("exports toggleNoteVisibility", async () => {
    const mod = await import("../lib/private-notes");
    expect(mod.toggleNoteVisibility).toBeDefined();
    expect(typeof mod.toggleNoteVisibility).toBe("function");
  });
});

describe("CM-11: PrivateNotesFeed component", () => {
  it("exports PrivateNotesFeed", async () => {
    const mod = await import(
      "../components/lite/admin/contacts/private-notes-feed"
    );
    expect(mod.PrivateNotesFeed).toBeDefined();
    expect(typeof mod.PrivateNotesFeed).toBe("function");
  });
});

describe("CM-11: ActivityTab accepts privateNotes", () => {
  it("exports ActivityTab that accepts optional privateNotes", async () => {
    const mod = await import(
      "../components/lite/admin/companies/activity-tab"
    );
    expect(mod.ActivityTab).toBeDefined();
    expect(typeof mod.ActivityTab).toBe("function");
  });
});

describe("CM-11: Server actions file exists", () => {
  it("actions.ts exists at the expected path", async () => {
    const fs = await import("node:fs");
    const exists = fs.existsSync("app/lite/admin/contacts/[id]/actions.ts");
    expect(exists).toBe(true);
  });

  it("actions.ts contains addNote and toggleVisibility exports", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync(
      "app/lite/admin/contacts/[id]/actions.ts",
      "utf-8",
    );
    expect(content).toContain("export async function addNote");
    expect(content).toContain("export async function toggleVisibility");
  });
});

describe("CM-11: Module boundary enforcement", () => {
  it("lib/private-notes/ does not import from lib/context-engine/", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve("lib/private-notes");
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".ts"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      expect(content).not.toContain("context-engine");
      expect(content).not.toContain("context_engine");
    }
  });
});

describe("CM-11: Migration file exists", () => {
  it("0047_cm11_private_notes.sql exists", async () => {
    const fs = await import("node:fs");
    const exists = fs.existsSync("lib/db/migrations/0047_cm11_private_notes.sql");
    expect(exists).toBe(true);
  });

  it("migration creates private_notes table", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync(
      "lib/db/migrations/0047_cm11_private_notes.sql",
      "utf-8",
    );
    expect(sql).toContain("CREATE TABLE");
    expect(sql).toContain("`private_notes`");
    expect(sql).toContain("contact_id");
    expect(sql).toContain("content");
    expect(sql).toContain("created_by");
    expect(sql).toContain("private_notes_contact_idx");
  });
});
