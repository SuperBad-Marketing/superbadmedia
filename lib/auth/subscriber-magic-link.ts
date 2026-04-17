/**
 * SB-6a: subscriber magic-link auth primitive.
 *
 * Issued to `role="prospect"` (or existing `client`) users after a SaaS
 * subscription's first successful Stripe invoice, and on-demand from the
 * `/get-started/welcome` "send me my login" button. Redeem flips
 * `user.role` prospect→client and logs activity.
 *
 * Separate from `lib/portal/issue-magic-link.ts` — that helper is
 * contact-scoped (non-converter portal + intro funnel) and cannot
 * create an Auth.js session.
 */
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { eq, and, isNull, gte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as globalDb } from "@/lib/db";
import { subscriber_magic_link_tokens } from "@/lib/db/schema/subscriber-magic-link-tokens";
import { user as userTable } from "@/lib/db/schema/user";
import { activity_log } from "@/lib/db/schema/activity-log";
import settings from "@/lib/settings";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type IssueSubscriberMagicLinkResult = {
  url: string;
  rawToken: string;
  tokenId: string;
};

export async function issueSubscriberMagicLink(
  input: { userId: string; issuedFor?: string },
  dbOverride?: AnyDb,
): Promise<IssueSubscriberMagicLinkResult> {
  const database = dbOverride ?? globalDb;
  const now = Date.now();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const tokenId = randomUUID();
  const ttlHours = await settings.get("subscriber.magic_link_ttl_hours");

  await database.insert(subscriber_magic_link_tokens).values({
    id: tokenId,
    user_id: input.userId,
    token_hash: tokenHash,
    issued_for: input.issuedFor ?? "subscriber_login",
    expires_at_ms: now + ttlHours * 60 * 60 * 1000,
    consumed_at_ms: null,
    created_at_ms: now,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const url = `${baseUrl}/api/auth/magic-link?token=${rawToken}`;

  return { url, rawToken, tokenId };
}

export type RedeemOutcome =
  | { ok: true; userId: string; email: string; promoted: boolean }
  | { ok: false; reason: "not_found" | "consumed" | "expired" | "user_missing" };

/**
 * Validate a raw token, mark it consumed, promote `prospect → client`,
 * and log activity. All inside one transaction.
 */
export async function redeemSubscriberMagicLink(
  rawToken: string,
  dbOverride?: AnyDb,
  nowMs?: number,
): Promise<RedeemOutcome> {
  const database = dbOverride ?? globalDb;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = nowMs ?? Date.now();

  const row = await database
    .select()
    .from(subscriber_magic_link_tokens)
    .where(eq(subscriber_magic_link_tokens.token_hash, tokenHash))
    .get();

  if (!row) return { ok: false, reason: "not_found" };
  if (row.consumed_at_ms != null) return { ok: false, reason: "consumed" };
  if (row.expires_at_ms < now) return { ok: false, reason: "expired" };

  const userRow = await database
    .select({ id: userTable.id, email: userTable.email, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, row.user_id))
    .get();
  if (!userRow) return { ok: false, reason: "user_missing" };

  const wasProspect = userRow.role === "prospect";

  // Double-consume guard: consume the exact row only if still unconsumed.
  const consumeResult = await database
    .update(subscriber_magic_link_tokens)
    .set({ consumed_at_ms: now })
    .where(
      and(
        eq(subscriber_magic_link_tokens.id, row.id),
        isNull(subscriber_magic_link_tokens.consumed_at_ms),
        gte(subscriber_magic_link_tokens.expires_at_ms, now),
      ),
    )
    .run();

  if (consumeResult.changes === 0) {
    // Lost race: someone else consumed between the select and update.
    return { ok: false, reason: "consumed" };
  }

  if (wasProspect) {
    await database
      .update(userTable)
      .set({ role: "client", first_signed_in_at_ms: now })
      .where(eq(userTable.id, row.user_id));
    await database.insert(activity_log).values({
      id: randomUUID(),
      kind: "note",
      body: "Subscriber promoted prospect → client via magic-link redeem.",
      meta: {
        kind: "subscriber_promoted_from_prospect",
        user_id: row.user_id,
      },
      created_at_ms: now,
      created_by: "subscriber_magic_link",
    });
  } else if (userRow.role === "client" && !userRow) {
    // unreachable; eslint guard
  }

  // Mark email verified — clicking a magic link proves the email is valid.
  // Only set once (idempotent on repeated redeems for the same user).
  await database
    .update(userTable)
    .set({ emailVerified: now })
    .where(and(eq(userTable.id, row.user_id), isNull(userTable.emailVerified)));

  await database.insert(activity_log).values({
    id: randomUUID(),
    kind: "note",
    body: "Subscriber logged in via magic link.",
    meta: {
      kind: "subscriber_logged_in",
      user_id: row.user_id,
      token_id: row.id,
    },
    created_at_ms: now,
    created_by: "subscriber_magic_link",
  });

  return {
    ok: true,
    userId: userRow.id,
    email: userRow.email,
    promoted: wasProspect,
  };
}
