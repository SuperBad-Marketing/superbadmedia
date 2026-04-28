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
  it("produces a signed cookie value with payload.signature format", () => {
    const session: PortalSession = {
      contactId: "c-001",
      clientId: null,
      submissionId: null,
    };
    const encoded = encodePortalSession(session);
    expect(encoded).toBeTruthy();
    expect(encoded).toContain(".");
    const [payload, signature] = encoded.split(".");
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(signature).toMatch(/^[0-9a-f]+$/);
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

  it("returns null for invalid input", () => {
    expect(decodePortalSession("!!!not-base64!!!")).toBeNull();
  });

  it("returns null for unsigned payload (no signature)", () => {
    const unsigned = Buffer.from(
      JSON.stringify({ contactId: "c-forged" }),
    ).toString("base64url");
    expect(decodePortalSession(unsigned)).toBeNull();
  });

  it("returns null for tampered signature", () => {
    const session: PortalSession = {
      contactId: "c-004",
      clientId: null,
      submissionId: null,
    };
    const encoded = encodePortalSession(session);
    const [payload] = encoded.split(".");
    const tampered = `${payload}.deadbeefcafebabe0000000000000000000000000000000000000000000000000`;
    expect(decodePortalSession(tampered)).toBeNull();
  });

  it("returns null for tampered payload", () => {
    const session: PortalSession = {
      contactId: "c-005",
      clientId: null,
      submissionId: null,
    };
    const encoded = encodePortalSession(session);
    const [, signature] = encoded.split(".");
    const differentPayload = Buffer.from(
      JSON.stringify({ contactId: "c-forged" }),
    ).toString("base64url");
    expect(decodePortalSession(`${differentPayload}.${signature}`)).toBeNull();
  });

  it("defaults clientId and submissionId to null when absent in payload", () => {
    const minimal: PortalSession = {
      contactId: "c-003",
      clientId: null,
      submissionId: null,
    };
    const encoded = encodePortalSession(minimal);
    const decoded = decodePortalSession(encoded);
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
