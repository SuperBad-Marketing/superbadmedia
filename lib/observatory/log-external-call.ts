/**
 * Central cost-logging helper. Every external call — LLM, Stripe, Resend,
 * Twilio, SerpAPI, etc. — routes through this to log a row in
 * `external_call_log`. Feature code never inserts directly.
 *
 * Owner: COB-1 (Wave 21). Consumers: every vendor wrapper.
 */
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ExternalCallActorType } from "@/lib/db/schema/external-call-log";

export interface LogExternalCallInput {
  job: string;
  actorType: ExternalCallActorType;
  actorId?: string | null;
  sharedCohortId?: string | null;
  units: Record<string, unknown>;
  estimatedCostAud: number;
  promptVersionHash?: string | null;
}

export async function logExternalCall(
  input: LogExternalCallInput,
  dbArg?: typeof defaultDb,
): Promise<string> {
  const id = crypto.randomUUID();
  const d = dbArg ?? defaultDb;
  await d.insert(external_call_log).values({
    id,
    job: input.job,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    shared_cohort_id: input.sharedCohortId ?? null,
    units: input.units,
    estimated_cost_aud: input.estimatedCostAud,
    prompt_version_hash: input.promptVersionHash ?? null,
    converted_from_candidate_id: null,
    created_at_ms: Date.now(),
  });
  return id;
}
