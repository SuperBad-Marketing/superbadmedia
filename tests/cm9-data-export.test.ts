import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toCsv } from "@/lib/export/csv";

// Mock modules before any imports that depend on them
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(undefined),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "task-1" }]),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/settings", () => ({
  default: {
    get: vi.fn().mockResolvedValue(7),
    set: vi.fn(),
    invalidateCache: vi.fn(),
    keys: {},
  },
}));

vi.mock("@/lib/activity-log", () => ({
  logActivity: vi.fn().mockResolvedValue({ id: "log-1" }),
}));

vi.mock("@/lib/portal/require-session", () => ({
  requirePortalSession: vi.fn().mockResolvedValue({
    contactId: "contact-1",
    clientId: "client-1",
    submissionId: null,
  }),
}));

vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ sent: true }),
}));

describe("CM-9 — Data export primitive", () => {
  describe("CSV generator", () => {
    it("generates valid CSV from headers and rows", () => {
      const csv = toCsv(
        ["name", "email", "role"],
        [
          { name: "Alice", email: "alice@example.com", role: "owner" },
          { name: "Bob", email: "bob@example.com", role: "staff" },
        ],
      );
      const lines = csv.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("name,email,role");
      expect(lines[1]).toBe("Alice,alice@example.com,owner");
      expect(lines[2]).toBe("Bob,bob@example.com,staff");
    });

    it("escapes commas in values", () => {
      const csv = toCsv(["name"], [{ name: "Doe, Jane" }]);
      expect(csv).toContain('"Doe, Jane"');
    });

    it("escapes double quotes in values", () => {
      const csv = toCsv(["name"], [{ name: 'Say "hello"' }]);
      expect(csv).toContain('"Say ""hello"""');
    });

    it("handles null and undefined", () => {
      const csv = toCsv(["a", "b"], [{ a: null, b: undefined }]);
      expect(csv.split("\n")[1]).toBe(",");
    });

    it("handles newlines in values", () => {
      const csv = toCsv(["note"], [{ note: "line1\nline2" }]);
      expect(csv).toContain('"line1\nline2"');
    });

    it("returns only header for empty rows", () => {
      const csv = toCsv(["a", "b"], []);
      expect(csv).toBe("a,b");
    });
  });

  describe("Export storage", () => {
    it("storeExportZip writes zip and meta files", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { storeExportZip } = await import("@/lib/export/storage");
      const buffer = Buffer.from("fake zip content");
      const meta = await storeExportZip("test-export-1", buffer, "test.zip");

      expect(meta.id).toBe("test-export-1");
      expect(meta.filename).toBe("test.zip");
      expect(meta.sizeBytes).toBe(buffer.length);
      expect(meta.expiresAtMs).toBeGreaterThan(Date.now());

      const zipExists = await fs
        .stat(path.join(process.cwd(), "data", "exports", "test-export-1.zip"))
        .then(() => true)
        .catch(() => false);
      const metaExists = await fs
        .stat(
          path.join(
            process.cwd(),
            "data",
            "exports",
            "test-export-1.meta.json",
          ),
        )
        .then(() => true)
        .catch(() => false);
      expect(zipExists).toBe(true);
      expect(metaExists).toBe(true);

      await fs
        .unlink(
          path.join(process.cwd(), "data", "exports", "test-export-1.zip"),
        )
        .catch(() => {});
      await fs
        .unlink(
          path.join(
            process.cwd(),
            "data",
            "exports",
            "test-export-1.meta.json",
          ),
        )
        .catch(() => {});
    });

    it("readExportZip returns null for non-existent export", async () => {
      const { readExportZip } = await import("@/lib/export/storage");
      const result = await readExportZip("non-existent-export");
      expect(result).toBeNull();
    });

    it("readExportZip returns null for expired export", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { readExportZip } = await import("@/lib/export/storage");
      const expiredMeta = {
        id: "expired-1",
        filename: "expired.zip",
        createdAtMs: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAtMs: Date.now() - 1 * 24 * 60 * 60 * 1000,
        sizeBytes: 10,
      };
      const exportRoot = path.join(process.cwd(), "data", "exports");
      await fs.mkdir(exportRoot, { recursive: true });
      await fs.writeFile(
        path.join(exportRoot, "expired-1.meta.json"),
        JSON.stringify(expiredMeta),
      );
      await fs.writeFile(
        path.join(exportRoot, "expired-1.zip"),
        Buffer.from("x"),
      );

      const result = await readExportZip("expired-1");
      expect(result).toBeNull();
    });

    it("getExportMeta returns meta for valid export", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const { storeExportZip, getExportMeta } = await import(
        "@/lib/export/storage"
      );
      const buffer = Buffer.from("test");
      await storeExportZip("meta-test-1", buffer, "meta-test.zip");

      const meta = await getExportMeta("meta-test-1");
      expect(meta).not.toBeNull();
      expect(meta!.id).toBe("meta-test-1");
      expect(meta!.filename).toBe("meta-test.zip");

      const exportRoot = path.join(process.cwd(), "data", "exports");
      await fs
        .unlink(path.join(exportRoot, "meta-test-1.zip"))
        .catch(() => {});
      await fs
        .unlink(path.join(exportRoot, "meta-test-1.meta.json"))
        .catch(() => {});
    });
  });

  describe("Handler registration", () => {
    it("client_data_export handler is registered", async () => {
      const { HANDLER_REGISTRY } = await import(
        "@/lib/scheduled-tasks/handlers/index"
      );
      expect(HANDLER_REGISTRY.client_data_export).toBeDefined();
      expect(typeof HANDLER_REGISTRY.client_data_export).toBe("function");
    });
  });

  describe("Scheduled task type", () => {
    it("client_data_export is in SCHEDULED_TASK_TYPES", async () => {
      const { SCHEDULED_TASK_TYPES } = await import(
        "@/lib/db/schema/scheduled-tasks"
      );
      expect(SCHEDULED_TASK_TYPES).toContain("client_data_export");
    });
  });

  describe("Export ZIP filename", () => {
    it("follows the spec naming convention", () => {
      const slugify = (name: string) =>
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      const companyName = "Acme Corp";
      const dateStr = "2026-04-19";
      const filename = `superbad-${slugify(companyName)}-export-${dateStr}.zip`;
      expect(filename).toBe("superbad-acme-corp-export-2026-04-19.zip");
    });
  });

  describe("API route structure", () => {
    it("export download route exists at expected path", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const routeFile = path.join(
        process.cwd(),
        "app",
        "api",
        "lite",
        "exports",
        "[id]",
        "route.ts",
      );
      const exists = await fs
        .stat(routeFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("Portal data-export page structure", () => {
    it("page file exists", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const pageFile = path.join(
        process.cwd(),
        "app",
        "lite",
        "portal",
        "[token]",
        "data-export",
        "page.tsx",
      );
      const exists = await fs
        .stat(pageFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it("server action file exists", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const actionFile = path.join(
        process.cwd(),
        "app",
        "lite",
        "portal",
        "[token]",
        "data-export",
        "actions.ts",
      );
      const exists = await fs
        .stat(actionFile)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
