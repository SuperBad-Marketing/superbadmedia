import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

describe("AT-2 — Free Audit Tool frontend", () => {
  const root = resolve(__dirname, "..");

  it("page.tsx exists at /get-started/audit", () => {
    expect(existsSync(resolve(root, "app/get-started/audit/page.tsx"))).toBe(true);
  });

  it("audit client component exists", () => {
    expect(
      existsSync(resolve(root, "app/get-started/audit/_components/audit-client.tsx")),
    ).toBe(true);
  });

  it("Turnstile env vars declared in .env.example", () => {
    const envExample = require("fs").readFileSync(
      resolve(root, ".env.example"),
      "utf-8",
    );
    expect(envExample).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(envExample).toContain("TURNSTILE_SECRET_KEY");
  });

  it("SSE streaming endpoint exists", () => {
    expect(
      existsSync(resolve(root, "app/api/audit/submit-stream/route.ts")),
    ).toBe(true);
  });

  it("sync submit endpoint exists", () => {
    expect(existsSync(resolve(root, "app/api/audit/submit/route.ts"))).toBe(
      true,
    );
  });

  it("scoring module exists", () => {
    expect(existsSync(resolve(root, "lib/audit/scoring.ts"))).toBe(true);
  });
});
