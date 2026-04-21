/**
 * Central cost-logging helper. Every external call — LLM, Stripe, Resend,
 * Twilio, SerpAPI, etc. — routes through this to log a row in
 * `external_call_log`. Feature code never inserts directly.
 *
 * Unknown-job trap (spec §4.2): if `job` is not in the registry, the
 * insert still succeeds (never lose data) but a synthetic tier-severe
 * `cost_anomaly` is created. In development, throws hard.
 *
 * Owner: COB-1 (Wave 21). Consumers: every vendor wrapper.
 */
import { db as defaultDb } from "@/lib/db";
import { external_call_log } from "@/lib/db/schema/external-call-log";
import type { ExternalCallActorType } from "@/lib/db/schema/external-call-log";
import { cost_anomalies } from "@/lib/db/schema/cost-anomalies";
import { isJobRegistered } from "./job-registry";
import { checkPerCallThreshold } from "./hard-threshold-detector";

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

  checkPerCallThreshold(
    { job: input.job, estimatedCostAud: input.estimatedCostAud },
    d,
  ).catch(() => {});

  if (!isJobRegistered(input.job)) {
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        `Unregistered job "${input.job}" logged to external_call_log. ` +
        `Register it in lib/observatory/job-registry.ts before shipping.`,
      );
    }
    const now = Date.now();
    d.insert(cost_anomalies)
      .values({
        id: crypto.randomUUID(),
        detector: "hard_threshold",
        job: input.job,
        tier: "severe",
        first_fired_at_ms: now,
        last_fired_at_ms: now,
        fire_count: 1,
        observed_value: input.estimatedCostAud,
        expected_band: { unregistered: true, message: `Job "${input.job}" is not in the registry` },
      })
      .catch(() => {});
  }

  return id;
}
