import { randomBytes, createHash, randomUUID } from "node:crypto";
import { db as globalDb } from "@/lib/db";
import { bench_magic_links } from "@/lib/db/schema/bench-magic-links";
import settings from "@/lib/settings";
import { logActivity } from "@/lib/activity-log";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type IssueBenchMagicLinkInput = {
  candidateId: string;
  issuedFor?: string;
};

export type IssueBenchMagicLinkResult = {
  url: string;
  rawToken: string;
};

export async function issueBenchMagicLink(
  input: IssueBenchMagicLinkInput,
  dbOverride?: AnyDb,
): Promise<IssueBenchMagicLinkResult> {
  const database = dbOverride ?? globalDb;

  const ttlHours = await settings.get("portal.magic_link_ttl_hours");
  const now = Date.now();
  const rawToken = randomBytes(32).toString("base64url");
  const ottHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAtMs = now + ttlHours * 60 * 60 * 1000;

  await database.insert(bench_magic_links).values({
    id: randomUUID(),
    candidate_id: input.candidateId,
    ott_hash: ottHash,
    issued_for: input.issuedFor ?? "bench_access",
    expires_at_ms: expiresAtMs,
    consumed_at_ms: null,
    created_at_ms: now,
  });

  await logActivity({
    kind: "bench_magic_link_sent",
    body: `Bench magic link issued for ${input.issuedFor ?? "bench_access"}`,
    meta: { candidate_id: input.candidateId },
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const url = `${baseUrl}/bench/r/${rawToken}`;

  return { url, rawToken };
}
