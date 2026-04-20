import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { user } from "@/lib/db/schema/user";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log";
import type { TriggerEvidence } from "./trigger-evaluator";
import type { ActorType } from "@/lib/db/schema/hidden-egg-fires";
import { updateFiredEggIds } from "./cadence";

export interface FireEggParams {
  eggId: string;
  actorType: ActorType;
  userId?: string;
  visitorId?: string;
  sessionId?: string;
  evidence: TriggerEvidence;
  outcome?: string;
}

export async function fireEgg(params: FireEggParams): Promise<string> {
  const id = nanoid();
  const now = Date.now();

  await db.insert(hidden_egg_fires).values({
    id,
    egg_id: params.eggId,
    actor_type: params.actorType,
    user_id: params.userId ?? null,
    visitor_id: params.visitorId ?? null,
    fired_at_ms: now,
    trigger_evidence: params.evidence,
    session_id: params.sessionId ?? null,
    outcome: params.outcome ?? null,
  });

  if (params.userId) {
    const rows = await db
      .select({ fired_egg_ids_recent: user.fired_egg_ids_recent })
      .from(user)
      .where(eq(user.id, params.userId))
      .limit(1);

    const current = (rows[0]?.fired_egg_ids_recent as string[]) ?? [];
    const updated = updateFiredEggIds(current, params.eggId);

    await db
      .update(user)
      .set({
        last_hidden_egg_fired_at_ms: now,
        fired_egg_ids_recent: updated,
      })
      .where(eq(user.id, params.userId));
  }

  await logActivity({
    kind: "hidden_egg_fired",
    body: `Egg ${params.eggId} fired for ${params.actorType}`,
    meta: { egg_id: params.eggId, actor_type: params.actorType },
  });

  return id;
}
