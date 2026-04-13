/**
 * Brand DNA gate tests — A8.
 *
 * Tests the `applyBrandDnaGate` pure function and the `isAdminPath` helper.
 * Both are exported from `lib/auth/auth.ts` and can be tested without
 * any DB, Next.js request objects, or network calls.
 *
 * Acceptance criteria tested:
 *   - Admin route + no brand DNA + no bypass → redirect_to_onboarding
 *   - Admin route + no brand DNA + bypass → allow
 *   - Admin route + brand DNA complete → allow
 *   - /lite/onboarding path → allow (no redirect loop)
 *   - Non-admin route → not an admin path (isAdminPath returns false)
 */
import { describe, it, expect } from "vitest";
// Import from has-completed-critical-flight.ts (no next-auth dependency)
// so the test runs cleanly in the Vitest node environment.
import {
  applyBrandDnaGate,
  isAdminPath,
} from "@/lib/auth/has-completed-critical-flight";

describe("applyBrandDnaGate", () => {
  it("redirects when brand DNA incomplete, no bypass", () => {
    expect(applyBrandDnaGate(false, false, "/lite/admin/dashboard")).toBe(
      "redirect_to_onboarding",
    );
  });

  it("redirects when brand DNA undefined (first-ever session), no bypass", () => {
    expect(applyBrandDnaGate(undefined, false, "/lite/finance")).toBe(
      "redirect_to_onboarding",
    );
  });

  it("allows when brand DNA complete, no bypass", () => {
    expect(applyBrandDnaGate(true, false, "/lite/admin/dashboard")).toBe(
      "allow",
    );
  });

  it("allows when brand DNA incomplete but bypass=true", () => {
    expect(applyBrandDnaGate(false, true, "/lite/admin/anything")).toBe(
      "allow",
    );
  });

  it("allows when brand DNA undefined but bypass=true", () => {
    expect(applyBrandDnaGate(undefined, true, "/lite/admin/anything")).toBe(
      "allow",
    );
  });

  it("allows /lite/onboarding even without brand DNA (no redirect loop)", () => {
    expect(applyBrandDnaGate(false, false, "/lite/onboarding")).toBe("allow");
  });

  it("allows /lite/onboarding sub-paths (BDA wizard steps)", () => {
    expect(applyBrandDnaGate(false, false, "/lite/onboarding/step/1")).toBe(
      "allow",
    );
  });
});

describe("isAdminPath", () => {
  it("returns true for /lite/ routes", () => {
    expect(isAdminPath("/lite/design")).toBe(true);
    expect(isAdminPath("/lite/finance/expenses")).toBe(true);
    expect(isAdminPath("/lite/admin/dashboard")).toBe(true);
  });

  it("returns false for /lite/portal/* (client portal)", () => {
    expect(isAdminPath("/lite/portal/abc123")).toBe(false);
    expect(isAdminPath("/lite/portal/recover")).toBe(false);
  });

  it("returns false for /lite/onboarding (gate redirect target)", () => {
    expect(isAdminPath("/lite/onboarding")).toBe(false);
    expect(isAdminPath("/lite/onboarding/step/1")).toBe(false);
  });

  it("returns false for non-/lite/ paths", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/api/something")).toBe(false);
    expect(isAdminPath("/marketing")).toBe(false);
  });

  it("returns false for /api/auth/* (NextAuth endpoints)", () => {
    expect(isAdminPath("/api/auth/session")).toBe(false);
  });
});
