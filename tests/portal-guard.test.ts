/**
 * Portal guard tests — A8.
 *
 * Tests the HMAC-signed portal session cookie helpers:
 *   buildPortalCookieValue / verifyPortalCookieValue / checkPortalGuard
 *
 * No DB or Next.js infrastructure needed — pure crypto functions.
 */
import { describe, it, expect } from "vitest";
import {
  buildPortalCookieValue,
  verifyPortalCookieValue,
  checkPortalGuard,
  buildPortalCookieAttrs,
  PORTAL_COOKIE_NAME,
} from "@/lib/portal/guard";

const TEST_SECRET = "test-secret-do-not-use-in-prod";
const CONTACT_ID = "contact_abc123";

describe("buildPortalCookieValue", () => {
  it("returns a non-empty string", () => {
    const value = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    expect(value).toBeTypeOf("string");
    expect(value.length).toBeGreaterThan(0);
  });

  it("embeds the contactId before the dot", () => {
    const value = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    expect(value.startsWith(`${CONTACT_ID}.`)).toBe(true);
  });

  it("produces different values for different secrets", () => {
    const v1 = buildPortalCookieValue(CONTACT_ID, "secret-a");
    const v2 = buildPortalCookieValue(CONTACT_ID, "secret-b");
    expect(v1).not.toBe(v2);
  });

  it("produces different values for different contactIds", () => {
    const v1 = buildPortalCookieValue("contact_1", TEST_SECRET);
    const v2 = buildPortalCookieValue("contact_2", TEST_SECRET);
    expect(v1).not.toBe(v2);
  });
});

describe("verifyPortalCookieValue", () => {
  it("returns the contactId for a valid signed cookie", () => {
    const signed = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    expect(verifyPortalCookieValue(signed, TEST_SECRET)).toBe(CONTACT_ID);
  });

  it("returns null for undefined input", () => {
    expect(verifyPortalCookieValue(undefined, TEST_SECRET)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(verifyPortalCookieValue("", TEST_SECRET)).toBeNull();
  });

  it("returns null for a tampered value (changed contactId)", () => {
    const signed = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    const tampered = `contact_evil.${signed.split(".")[1]}`;
    expect(verifyPortalCookieValue(tampered, TEST_SECRET)).toBeNull();
  });

  it("returns null for a tampered signature", () => {
    const signed = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    const parts = signed.split(".");
    const tampered = `${parts[0]}.deadbeefdeadbeef`;
    expect(verifyPortalCookieValue(tampered, TEST_SECRET)).toBeNull();
  });

  it("returns null for a wrong secret", () => {
    const signed = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    expect(verifyPortalCookieValue(signed, "wrong-secret")).toBeNull();
  });

  it("returns null for a string with no dot", () => {
    expect(verifyPortalCookieValue("nodothere", TEST_SECRET)).toBeNull();
  });
});

describe("checkPortalGuard", () => {
  it("returns allowed:true + contactId for a valid cookie", () => {
    const cookie = buildPortalCookieValue(CONTACT_ID, TEST_SECRET);
    const result = checkPortalGuard(cookie, TEST_SECRET);
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.contactId).toBe(CONTACT_ID);
  });

  it("returns allowed:false for missing cookie", () => {
    const result = checkPortalGuard(undefined, TEST_SECRET);
    expect(result.allowed).toBe(false);
  });

  it("returns allowed:false for invalid cookie", () => {
    const result = checkPortalGuard("garbage", TEST_SECRET);
    expect(result.allowed).toBe(false);
  });

  it("returns allowed:false for wrong-secret cookie", () => {
    const cookie = buildPortalCookieValue(CONTACT_ID, "other-secret");
    const result = checkPortalGuard(cookie, TEST_SECRET);
    expect(result.allowed).toBe(false);
  });
});

describe("buildPortalCookieAttrs", () => {
  it("returns correct cookie name", () => {
    const attrs = buildPortalCookieAttrs(CONTACT_ID, 90, TEST_SECRET);
    expect(attrs.name).toBe(PORTAL_COOKIE_NAME);
  });

  it("sets httpOnly true", () => {
    const attrs = buildPortalCookieAttrs(CONTACT_ID, 90, TEST_SECRET);
    expect(attrs.httpOnly).toBe(true);
  });

  it("sets sameSite lax", () => {
    const attrs = buildPortalCookieAttrs(CONTACT_ID, 90, TEST_SECRET);
    expect(attrs.sameSite).toBe("lax");
  });

  it("calculates maxAge correctly for given ttlDays", () => {
    const attrs = buildPortalCookieAttrs(CONTACT_ID, 30, TEST_SECRET);
    expect(attrs.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it("round-trips — verifying the cookie value it builds", () => {
    const attrs = buildPortalCookieAttrs(CONTACT_ID, 90, TEST_SECRET);
    expect(verifyPortalCookieValue(attrs.value, TEST_SECRET)).toBe(CONTACT_ID);
  });
});
