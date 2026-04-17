/**
 * OS-3: createOnboardingCredentials() unit tests.
 * Mocks db, sendEmail, logActivity, issueSubscriberMagicLink.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockInsertValues = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
        }),
      }),
    }),
    insert: () => ({
      values: mockInsertValues,
    }),
  },
}));

const mockIssueSubscriberMagicLink = vi.fn();
vi.mock("@/lib/auth/subscriber-magic-link", () => ({
  issueSubscriberMagicLink: (...args: unknown[]) =>
    mockIssueSubscriberMagicLink(...args),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/channels/email/send", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockLogActivity = vi.fn();
vi.mock("@/lib/activity-log", () => ({
  logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

import { createOnboardingCredentials } from "@/lib/onboarding/create-credentials";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3001";
});

describe("createOnboardingCredentials", () => {
  it("returns contact_not_found when contact does not exist", async () => {
    mockGet.mockReturnValueOnce(null);

    const result = await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });
    expect(result).toEqual({ ok: false, reason: "contact_not_found" });
  });

  it("returns email_missing when contact has no email", async () => {
    mockGet.mockReturnValueOnce({ id: "c-1", email: null, name: "Test" });

    const result = await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });
    expect(result).toEqual({ ok: false, reason: "email_missing" });
  });

  it("returns already_verified when user already has emailVerified", async () => {
    // contact query
    mockGet.mockReturnValueOnce({ id: "c-1", email: "a@b.com", name: "Test" });
    // existing user query — already verified
    mockGet.mockReturnValueOnce({ id: "u-1", emailVerified: Date.now() });

    const result = await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });
    expect(result).toEqual({ ok: false, reason: "already_verified" });
  });

  it("creates user + issues magic link + sends email on success", async () => {
    // contact query
    mockGet.mockReturnValueOnce({
      id: "c-1",
      email: "alice@example.com",
      name: "Alice Smith",
    });
    // existing user query — no existing user
    mockGet.mockReturnValueOnce(null);
    // insert user
    mockInsertValues.mockResolvedValueOnce(undefined);
    // issue magic link
    mockIssueSubscriberMagicLink.mockResolvedValueOnce({
      url: "http://localhost:3001/api/auth/magic-link?token=abc123",
      rawToken: "abc123",
      tokenId: "tid-1",
    });
    // sendEmail
    mockSendEmail.mockResolvedValueOnce(undefined);
    // logActivity
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.magicLinkUrl).toContain("&redirect=/lite/portal");
    }

    expect(mockIssueSubscriberMagicLink).toHaveBeenCalledWith(
      expect.objectContaining({ issuedFor: "onboarding_credentials" }),
      expect.anything(),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        classification: "transactional",
        purpose: "onboarding_credentials",
      }),
    );
  });

  it("reuses existing unverified user instead of creating new", async () => {
    // contact query
    mockGet.mockReturnValueOnce({
      id: "c-1",
      email: "bob@example.com",
      name: "Bob",
    });
    // existing user query — unverified
    mockGet.mockReturnValueOnce({ id: "existing-u-1", emailVerified: null });
    // issue magic link
    mockIssueSubscriberMagicLink.mockResolvedValueOnce({
      url: "http://localhost:3001/api/auth/magic-link?token=xyz",
      rawToken: "xyz",
      tokenId: "tid-2",
    });
    // sendEmail
    mockSendEmail.mockResolvedValueOnce(undefined);
    // logActivity
    mockLogActivity.mockResolvedValueOnce(undefined);

    const result = await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("existing-u-1");
    }
    // Should NOT have called insert (reused existing user)
    expect(mockInsertValues).not.toHaveBeenCalled();
  });

  it("uses first name in email greeting", async () => {
    // contact query
    mockGet.mockReturnValueOnce({
      id: "c-1",
      email: "charlie@example.com",
      name: "Charlie Brown",
    });
    // existing user query — none
    mockGet.mockReturnValueOnce(null);
    mockInsertValues.mockResolvedValueOnce(undefined);
    mockIssueSubscriberMagicLink.mockResolvedValueOnce({
      url: "http://localhost:3001/api/auth/magic-link?token=def",
      rawToken: "def",
      tokenId: "tid-3",
    });
    mockSendEmail.mockResolvedValueOnce(undefined);
    mockLogActivity.mockResolvedValueOnce(undefined);

    await createOnboardingCredentials({
      contactId: "c-1",
      companyId: "co-1",
    });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Hey Charlie"),
      }),
    );
  });
});
