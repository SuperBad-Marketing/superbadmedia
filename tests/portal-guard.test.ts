/**
 * Portal session guard tests — A8.
 *
 * Tests the encode/decode helpers directly (pure functions, no Next.js APIs).
 * Tests `getPortalSession()` by mocking `next/headers`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist the cookie mock so vi.mock runs before imports ─────────────────────
const mockCookieGet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
  }),
}));

import {
  encodePortalSession,
  decodePortalSession,
  getPortalSession,
  PORTAL_SESSION_COOKIE,
} from "@/lib/portal/guard";
import type { PortalSession } from "@/lib/portal/guard";

// ── encodePortalSession / decodePortalSession ────────────────────────────────

describe("encodePortalSession", () => {
  it("produces a non-empty base64url string", () => {
    const session: PortalSession = {
      contactId: "c-001",
      clientId: null,
      submissionId: null,
    };
    const encoded = encodePortalSession(session);
    expect(encoded).toBeTruthy();
    // base64url uses A-Za-z0-9_- (no padding =)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("decodePortalSession", () => {
  it("round-trips a full session", () => {
    const session: PortalSession = {
      contactId: "c-001",
      clientId: "cl-001",
      submissionId: "sub-001",
    };
    const encoded = encodePortalSession(session);
    const decoded = decodePortalSession(encoded);

    expect(decoded).toEqual(session);
  });

  it("round-trips a session with null optional fields", () => {
    const session: PortalSession = {
      contactId: "c-002",
      clientId: null,
      submissionId: null,
    };
    const decoded = decodePortalSession(encodePortalSession(session));
    expect(decoded).toEqual(session);
  });

  it("returns null for an empty string", () => {
    expect(decodePortalSession("")).toBeNull();
  });

  it("returns null for invalid base64url", () => {
    expect(decodePortalSession("!!!not-base64!!!")).toBeNull();
  });

  it("returns null for valid base64url but missing contactId", () => {
    const bad = Buffer.from(JSON.stringify({ clientId: "c" })).toString(
      "base64url",
    );
    expect(decodePortalSession(bad)).toBeNull();
  });

  it("returns null for valid base64url but non-object JSON", () => {
    const bad = Buffer.from("true").toString("base64url");
    expect(decodePortalSession(bad)).toBeNull();
  });

  it("defaults clientId and submissionId to null when absent in payload", () => {
    const minimal = Buffer.from(
      JSON.stringify({ contactId: "c-003" }),
    ).toString("base64url");
    const decoded = decodePortalSession(minimal);
    expect(decoded).toEqual({
      contactId: "c-003",
      clientId: null,
      submissionId: null,
    });
  });
});

// ── getPortalSession — mocked next/headers ────────────────────────────────────

describe("getPortalSession", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
  });

  it("returns null when the cookie is absent", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const result = await getPortalSession();
    expect(result).toBeNull();
  });

  it("returns the decoded session when a valid cookie is present", async () => {
    const session: PortalSession = {
      contactId: "c-cookie",
      clientId: null,
      submissionId: "sub-cookie",
    };
    const cookieValue = encodePortalSession(session);
    mockCookieGet.mockImplementation((name: string) => {
      if (name === PORTAL_SESSION_COOKIE) return { value: cookieValue };
      return undefined;
    });

    const result = await getPortalSession();
    expect(result).toEqual(session);
  });

  it("returns null when the cookie contains a malformed payload", async () => {
    mockCookieGet.mockReturnValue({ value: "!!!not-valid!!!" });

    const result = await getPortalSession();
    expect(result).toBeNull();
  });
});
