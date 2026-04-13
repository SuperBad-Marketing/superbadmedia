/**
 * cookie-consent.test.ts
 *
 * Tests for:
 *   - lib/geo/maxmind.ts — `isEuIp()` + `getClientIp()`
 *   - app/api/cookie-consent/route.ts — POST handler
 *
 * Owner: B3.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isEuIp, getClientIp } from "@/lib/geo/maxmind";

// ── getClientIp ────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("returns empty string for null", () => {
    expect(getClientIp(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(getClientIp(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(getClientIp("")).toBe("");
  });

  it("returns the single IP when no comma", () => {
    expect(getClientIp("1.2.3.4")).toBe("1.2.3.4");
  });

  it("returns leftmost IP from x-forwarded-for chain", () => {
    expect(getClientIp("1.2.3.4, 10.0.0.1, 172.16.0.2")).toBe("1.2.3.4");
  });

  it("trims whitespace", () => {
    expect(getClientIp("  1.2.3.4  ,  5.6.7.8  ")).toBe("1.2.3.4");
  });
});

// ── isEuIp ─────────────────────────────────────────────────────────────────

describe("isEuIp", () => {
  beforeEach(() => {
    // Reset env overrides before each test
    delete process.env.GEOIP_TEST_EU_IPS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false for empty string", async () => {
    expect(await isEuIp("")).toBe(false);
  });

  it("returns false for 127.0.0.1 (loopback)", async () => {
    expect(await isEuIp("127.0.0.1")).toBe(false);
  });

  it("returns false for ::1 (IPv6 loopback)", async () => {
    expect(await isEuIp("::1")).toBe(false);
  });

  it("returns false for private 192.168.x.x range", async () => {
    expect(await isEuIp("192.168.1.100")).toBe(false);
  });

  it("returns false for private 10.x.x.x range", async () => {
    expect(await isEuIp("10.0.0.1")).toBe(false);
  });

  it("returns true for IPs in GEOIP_TEST_EU_IPS", async () => {
    process.env.GEOIP_TEST_EU_IPS = "212.58.244.1,195.148.127.0";
    expect(await isEuIp("212.58.244.1")).toBe(true);
    expect(await isEuIp("195.148.127.0")).toBe(true);
  });

  it("returns false for IPs NOT in GEOIP_TEST_EU_IPS even when env is set", async () => {
    process.env.GEOIP_TEST_EU_IPS = "212.58.244.1";
    expect(await isEuIp("8.8.8.8")).toBe(false);
  });

  it("returns true for EU continentCode from fetch mock", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ continentCode: "EU", status: "success" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    expect(await isEuIp("52.28.0.0")).toBe(true);
  });

  it("returns false for non-EU continentCode from fetch mock", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ continentCode: "NA", status: "success" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    expect(await isEuIp("8.8.8.8")).toBe(false);
  });

  it("returns false when ip-api.com returns status=fail", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "fail", message: "private range" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    expect(await isEuIp("0.0.0.0")).toBe(false);
  });

  it("returns false when fetch throws (network error / timeout)", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(
      new Error("AbortError: timeout"),
    );
    expect(await isEuIp("52.28.0.0")).toBe(false);
  });

  it("returns false when fetch returns non-ok status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response("Service unavailable", { status: 503 }),
    );
    expect(await isEuIp("52.28.0.0")).toBe(false);
  });
});

// ── /api/cookie-consent route ──────────────────────────────────────────────

describe("/api/cookie-consent POST", () => {
  it("exports a POST function", async () => {
    const mod = await import("@/app/api/cookie-consent/route");
    expect(typeof mod.POST).toBe("function");
  });

  it("returns 400 for non-JSON body", async () => {
    const mod = await import("@/app/api/cookie-consent/route");
    const req = new Request("http://localhost/api/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid payload (missing categories)", async () => {
    const mod = await import("@/app/api/cookie-consent/route");
    const req = new Request("http://localhost/api/cookie-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true }),
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 200 ok for valid accept-all payload", async () => {
    const mod = await import("@/app/api/cookie-consent/route");
    const req = new Request("http://localhost/api/cookie-consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        accepted: true,
        categories: ["necessary", "functional", "analytics"],
        banner_version: "1.0",
      }),
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it("returns 200 ok for valid reject-all payload", async () => {
    const mod = await import("@/app/api/cookie-consent/route");
    const req = new Request("http://localhost/api/cookie-consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        accepted: false,
        categories: ["necessary"],
        banner_version: "1.0",
      }),
    });
    const res = await mod.POST(req as never);
    expect(res.status).toBe(200);
  });
});
