/**
 * POST /api/cookie-consent
 *
 * Records a cookie consent decision for EU visitors.
 * Non-EU visitors don't use this endpoint (they see a footer link only).
 *
 * Body: { accepted: boolean, categories: string[], banner_version: string }
 *
 * Privacy: IP is SHA-256 hashed before storage. No raw IP persisted.
 *
 * Auth: none required — consent is captured before/without login.
 * Rate-limiting: not enforced at v1.0 (PATCHES_OWED: b3_consent_rate_limit).
 *
 * Owner: B3. Spec: docs/specs/legal-pages.md §4.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { cookie_consents } from "@/lib/db/schema/cookie-consents";
import { getClientIp } from "@/lib/geo/maxmind";

type ConsentBody = {
  accepted: boolean;
  categories: string[];
  banner_version: string;
};

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ConsentBody;
  try {
    body = (await req.json()) as ConsentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { accepted, categories, banner_version } = body;

  if (typeof accepted !== "boolean" || !Array.isArray(categories)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const ip = getClientIp(req.headers.get("x-forwarded-for")) || "unknown";
  const ipHash = hashIp(ip);
  const now = Date.now();

  try {
    await db.insert(cookie_consents).values({
      id: randomUUID(),
      ip_hash: ipHash,
      user_id: null,
      accepted,
      categories: JSON.stringify(categories),
      banner_version: banner_version ?? "unknown",
      created_at_ms: now,
    });
  } catch (err) {
    console.error("[cookie-consent] DB insert failed:", err);
    // Non-fatal: consent was already saved to localStorage client-side
  }

  return NextResponse.json({ ok: true });
}
