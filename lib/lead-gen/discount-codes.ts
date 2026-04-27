import { randomUUID } from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { discountCodes } from "@/lib/db/schema/discount-codes";
import type { DiscountTier } from "@/lib/db/schema/discount-codes";

const CODE_PREFIX = "SB";
const HOLD_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return `${CODE_PREFIX}-${code}`;
}

export async function createDiscountCode(
  candidateId: string,
  tier: DiscountTier,
  originalPriceCents: number,
  dbInstance = defaultDb,
): Promise<{ code: string; expiresAtMs: number }> {
  const id = randomUUID();
  const code = generateCode();
  const now = Date.now();
  const expiresAtMs = now + HOLD_DURATION_MS;

  await dbInstance.insert(discountCodes).values({
    id,
    candidate_id: candidateId,
    code,
    tier,
    original_price_cents: originalPriceCents,
    expires_at_ms: expiresAtMs,
    created_at_ms: now,
  });

  return { code, expiresAtMs };
}

export interface ValidateCodeResult {
  valid: boolean;
  tier: DiscountTier | null;
  originalPriceCents: number | null;
  reason: "valid" | "not_found" | "expired" | "already_redeemed";
}

export async function validateDiscountCode(
  code: string,
  dbInstance = defaultDb,
): Promise<ValidateCodeResult> {
  const row = await dbInstance
    .select()
    .from(discountCodes)
    .where(eq(discountCodes.code, code))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!row) {
    return { valid: false, tier: null, originalPriceCents: null, reason: "not_found" };
  }

  if (row.redeemed_at_ms) {
    return { valid: false, tier: row.tier as DiscountTier, originalPriceCents: row.original_price_cents, reason: "already_redeemed" };
  }

  if (Date.now() > row.expires_at_ms) {
    return { valid: false, tier: row.tier as DiscountTier, originalPriceCents: row.original_price_cents, reason: "expired" };
  }

  return {
    valid: true,
    tier: row.tier as DiscountTier,
    originalPriceCents: row.original_price_cents,
    reason: "valid",
  };
}

export async function redeemDiscountCode(
  code: string,
  dbInstance = defaultDb,
): Promise<boolean> {
  const result = await dbInstance
    .update(discountCodes)
    .set({ redeemed_at_ms: Date.now() })
    .where(
      and(
        eq(discountCodes.code, code),
        isNull(discountCodes.redeemed_at_ms),
        gt(discountCodes.expires_at_ms, Date.now()),
      ),
    );

  return (result as { changes?: number }).changes === 1;
}
