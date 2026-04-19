import { createHash } from "node:crypto";
import { eq, sql, and, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditRateLimits } from "@/lib/db/schema/audit-submissions";
import { auditSubmissions } from "@/lib/db/schema/audit-submissions";
import settings from "@/lib/settings";

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function checkRateLimit(
  ipHash: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const maxPerIp = await settings.get("audit.rate_limit_per_ip");
  const windowMs = 24 * 60 * 60 * 1000;
  const windowStart = Date.now() - windowMs;

  const existing = await db
    .select()
    .from(auditRateLimits)
    .where(eq(auditRateLimits.ip_hash, ipHash))
    .limit(1);

  if (existing.length === 0) return { allowed: true };

  const row = existing[0];
  if (row.window_start.getTime() < windowStart) {
    return { allowed: true };
  }

  if (row.submission_count >= maxPerIp) {
    return {
      allowed: false,
      reason: "You've checked a few already today — come back tomorrow.",
    };
  }

  return { allowed: true };
}

export async function recordSubmission(ipHash: string): Promise<void> {
  const windowMs = 24 * 60 * 60 * 1000;
  const windowStart = Date.now() - windowMs;

  const existing = await db
    .select()
    .from(auditRateLimits)
    .where(eq(auditRateLimits.ip_hash, ipHash))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(auditRateLimits).values({
      ip_hash: ipHash,
      submission_count: 1,
      window_start: new Date(),
    });
    return;
  }

  const row = existing[0];
  if (row.window_start.getTime() < windowStart) {
    await db
      .update(auditRateLimits)
      .set({ submission_count: 1, window_start: new Date() })
      .where(eq(auditRateLimits.ip_hash, ipHash));
  } else {
    await db
      .update(auditRateLimits)
      .set({ submission_count: row.submission_count + 1 })
      .where(eq(auditRateLimits.ip_hash, ipHash));
  }
}

export async function checkDailyCap(): Promise<{ allowed: boolean; reason?: string }> {
  const cap = await settings.get("audit.daily_cap");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditSubmissions)
    .where(gte(auditSubmissions.created_at, todayStart));

  if (result.count >= cap) {
    return {
      allowed: false,
      reason: "We've hit our daily limit — try again tomorrow.",
    };
  }

  return { allowed: true };
}
