import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieGet = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
  }),
}));

const mockRedirect = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
);
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

import { requirePortalSession } from "@/lib/portal/require-session";
import {
  encodePortalSession,
  PORTAL_SESSION_COOKIE,
} from "@/lib/portal/guard";
import type { PortalSession } from "@/lib/portal/guard";

describe("requirePortalSession", () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    mockRedirect.mockClear();
  });

  it("returns session when cookie is valid", async () => {
    const session: PortalSession = {
      contactId: "c-001",
      clientId: "cl-001",
      submissionId: null,
    };
    mockCookieGet.mockImplementation((name: string) => {
      if (name === PORTAL_SESSION_COOKIE) {
        return { value: encodePortalSession(session) };
      }
      return undefined;
    });

    const result = await requirePortalSession();
    expect(result).toEqual(session);
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("redirects to /lite/portal/recover when cookie is absent", async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(requirePortalSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/lite/portal/recover");
  });

  it("redirects to /lite/portal/recover when cookie is malformed", async () => {
    mockCookieGet.mockImplementation((name: string) => {
      if (name === PORTAL_SESSION_COOKIE) {
        return { value: "garbage-data" };
      }
      return undefined;
    });

    await expect(requirePortalSession()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/lite/portal/recover");
  });
});
