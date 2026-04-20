import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db as globalDb } from "@/lib/db";
import { bench_magic_links } from "@/lib/db/schema/bench-magic-links";
import { logActivity } from "@/lib/activity-log";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = BetterSQLite3Database<any>;

export type RedeemedBenchSession = {
  candidateId: string;
};

export async function redeemBenchMagicLink(
  rawToken: string,
  dbOverride?: AnyDb,
): Promise<RedeemedBenchSession | null> {
  const database = dbOverride ?? globalDb;

  const ottHash = createHash("sha256").update(rawToken).digest("hex");

  const link = await database
    .select()
    .from(bench_magic_links)
    .where(eq(bench_magic_links.ott_hash, ottHash))
    .get();

  if (!link) return null;
  if (link.consumed_at_ms !== null) return null;
  if (link.expires_at_ms < Date.now()) return null;

  await database
    .update(bench_magic_links)
    .set({ consumed_at_ms: Date.now() })
    .where(eq(bench_magic_links.id, link.id));

  await logActivity({
    kind: "bench_magic_link_redeemed",
    body: "Bench magic link redeemed",
    meta: {
      candidate_id: link.candidate_id,
      issued_for: link.issued_for,
    },
  });

  return { candidateId: link.candidate_id };
}
