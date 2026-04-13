import { describe, it, expect } from "vitest";
import { can, ROLES, type Role } from "@/lib/auth/permissions";

describe("permissions.can()", () => {
  it("exports the 5 canonical roles", () => {
    expect(ROLES).toEqual([
      "admin",
      "client",
      "prospect",
      "anonymous",
      "system",
    ]);
  });

  it("allows admin on Finance GET routes (wildcard)", () => {
    expect(can("admin", "GET", "/lite/finance/expenses")).toBe(true);
    expect(can("admin", "GET", "/lite/finance/reports/q1")).toBe(true);
  });

  it("denies non-admin on Finance routes", () => {
    const nonAdmins: Role[] = ["client", "prospect", "anonymous", "system"];
    for (const role of nonAdmins) {
      expect(can(role, "GET", "/lite/finance/expenses")).toBe(false);
    }
  });

  it("allows admin on PUT to parameterised expense routes", () => {
    expect(can("admin", "PUT", "/lite/finance/expenses/abc-123")).toBe(true);
  });

  it("allows system on finance cron jobs", () => {
    expect(can("system", "CRON", "finance_snapshot_take")).toBe(true);
    expect(can("system", "CRON", "recurring_expense_book")).toBe(true);
  });

  it("denies admin on cron jobs (cron is system-only)", () => {
    expect(can("admin", "CRON", "finance_snapshot_take")).toBe(false);
  });

  it("default-denies unknown resource + action pairs", () => {
    expect(can("admin", "GET", "/lite/unknown/path")).toBe(false);
    expect(can("admin", "DELETE", "/lite/finance/expenses/1")).toBe(false);
  });
});
