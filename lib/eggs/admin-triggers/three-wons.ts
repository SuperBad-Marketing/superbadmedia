/**
 * @egg three_wons
 * @register admin-roommate
 * @reads
 *   - hidden_egg_fires (egg_id='three_wons', user_id) WHERE fired_at_ms >= now() - 30d
 * @does_not_read
 *   - any client-scoped data (brand_dna, context_summaries, messages, quotes, invoices)
 *   - deals table (session-local counter lives on the client; server only checks cooldown)
 * @cross_client_inference false
 * @evidence_fields [sessionWonCount, sessionId]
 */

import { db } from "@/lib/db";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { and, eq, gte } from "drizzle-orm";
import { auth } from "@/lib/auth/session";
import { fireEgg } from "../fire-egg";

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export async function maybeFireThreeWonsEgg(): Promise<boolean> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return false;

  const now = Date.now();
  const userId = session.user.id;

  const recentFires = await db
    .select({ fired_at_ms: hidden_egg_fires.fired_at_ms })
    .from(hidden_egg_fires)
    .where(
      and(
        eq(hidden_egg_fires.egg_id, "three_wons"),
        eq(hidden_egg_fires.user_id, userId),
        gte(hidden_egg_fires.fired_at_ms, now - COOLDOWN_MS),
      ),
    )
    .limit(1);

  if (recentFires.length > 0) return false;

  await fireEgg({
    eggId: "three_wons",
    actorType: "admin",
    userId,
    evidence: {
      sessionWonCount: 3,
      reason: "three_deals_won_in_session",
    },
  });

  return true;
}
