/**
 * ensureStripeCustomer idempotency tests — A7.
 *
 * Mocks the Stripe client singleton so no real API calls are made.
 * Verifies that:
 *   - A new customer is created when none exists
 *   - An existing customer is returned without creating a new one
 *   - Two calls with the same contactId yield one Stripe customer
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist mock before any import that resolves @/lib/stripe/client ────────────

const mockSearch = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());

const mockStripeInstance = {
  customers: {
    search: mockSearch,
    create: mockCreate,
  },
};

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => mockStripeInstance,
}));

import { ensureStripeCustomer } from "@/lib/stripe/customer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySearch() {
  mockSearch.mockResolvedValueOnce({ data: [] });
}

function foundCustomer(id: string) {
  mockSearch.mockResolvedValueOnce({ data: [{ id }] });
}

function createdCustomer(id: string) {
  mockCreate.mockResolvedValueOnce({
    id,
    metadata: { contact_id: "test-contact", platform: "superbad-lite" },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ensureStripeCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new customer when none exists", async () => {
    emptySearch();
    createdCustomer("cus_new123");

    const result = await ensureStripeCustomer("contact-abc");

    expect(result.customerId).toBe("cus_new123");
    expect(result.created).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith({
      metadata: { contact_id: "contact-abc", platform: "superbad-lite" },
    });
  });

  it("returns existing customer without creating", async () => {
    foundCustomer("cus_existing456");

    const result = await ensureStripeCustomer("contact-xyz");

    expect(result.customerId).toBe("cus_existing456");
    expect(result.created).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("is idempotent — second call returns same customerId", async () => {
    // First call: no customer exists → create
    emptySearch();
    createdCustomer("cus_idempotent789");

    const first = await ensureStripeCustomer("contact-idem");
    expect(first.customerId).toBe("cus_idempotent789");
    expect(first.created).toBe(true);

    // Second call: customer found → return, don't create again
    foundCustomer("cus_idempotent789");

    const second = await ensureStripeCustomer("contact-idem");
    expect(second.customerId).toBe("cus_idempotent789");
    expect(second.created).toBe(false);

    // Overall: search called twice, create called once
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("searches by metadata contact_id", async () => {
    emptySearch();
    createdCustomer("cus_meta");

    await ensureStripeCustomer("my-contact-id");

    expect(mockSearch).toHaveBeenCalledWith({
      query: `metadata['contact_id']:'my-contact-id'`,
      limit: 1,
    });
  });

  it("coerces ContactId branded type to string for search", async () => {
    emptySearch();
    createdCustomer("cus_branded");

    // Simulate a branded ContactId (string at runtime)
    const brandedId = "branded-contact-99" as unknown as import("@/lib/types/glossary").ContactId;
    const result = await ensureStripeCustomer(brandedId);

    expect(result.customerId).toBe("cus_branded");
    expect(mockSearch).toHaveBeenCalledWith({
      query: `metadata['contact_id']:'branded-contact-99'`,
      limit: 1,
    });
  });

  it("returns the first customer when search returns multiple (limit=1 handled by Stripe)", async () => {
    // search mock returns one (limit:1 is enforced server-side)
    mockSearch.mockResolvedValueOnce({ data: [{ id: "cus_first" }] });

    const result = await ensureStripeCustomer("contact-multi");
    expect(result.customerId).toBe("cus_first");
    expect(result.created).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
