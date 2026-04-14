/**
 * Completion-contract enforcer — SW-3.
 *
 * Runs BEFORE the celebration step marks a wizard complete:
 *   1. Every `contract.required` key is present (non-null, non-undefined)
 *      in the payload.
 *   2. `contract.verify(payload)` resolves inside `wizards.verify_timeout_ms`
 *      and returns `{ ok: true }` (real-vendor round-trip — owned by each
 *      wizard).
 *   3. If artefacts declare `integrationConnections: true` and the wizard
 *      carries a `vendorManifest`, an active row exists in
 *      `integration_connections` for that vendor + owner.
 *   4. If artefacts declare an `activityLog` kind, a matching row exists
 *      within the last hour.
 *
 * Spec: docs/specs/setup-wizards.md §3.3.
 * Owner: SW-3. Consumer: celebration step's onComplete orchestrator.
 */
import { and, eq, gte } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { activity_log } from "@/lib/db/schema/activity-log";
import settings from "@/lib/settings";
import type { WizardDefinition } from "@/lib/wizards/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = typeof defaultDb | any;

export type VerifyOwnerCtx = {
  ownerType: "admin" | "client";
  ownerId: string;
};

export type VerifyResult = { ok: true } | { ok: false; reason: string };

const ARTEFACT_RECENCY_MS = 60 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`verify() timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

export async function verifyCompletion<T extends object>(
  definition: WizardDefinition<T>,
  payload: T,
  ctx?: VerifyOwnerCtx,
  dbArg?: DbLike,
): Promise<VerifyResult> {
  const db = dbArg ?? defaultDb;
  const contract = definition.completionContract;

  for (const key of contract.required) {
    const v = (payload as Record<string, unknown>)[key as string];
    if (v === undefined || v === null) {
      return { ok: false, reason: `Missing required field: ${String(key)}` };
    }
  }

  const timeoutMs = await settings.get("wizards.verify_timeout_ms");
  let verifyResult: VerifyResult;
  try {
    verifyResult = await withTimeout(contract.verify(payload), timeoutMs);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "verify() threw",
    };
  }
  if (!verifyResult.ok) return verifyResult;

  if (contract.artefacts.integrationConnections) {
    if (!definition.vendorManifest) {
      return {
        ok: false,
        reason:
          "Contract requires integration_connections but wizard has no vendorManifest.",
      };
    }
    if (!ctx) {
      return {
        ok: false,
        reason:
          "Contract requires integration_connections but no owner context passed.",
      };
    }
    const rows = await db
      .select({ id: integration_connections.id })
      .from(integration_connections)
      .where(
        and(
          eq(
            integration_connections.vendor_key,
            definition.vendorManifest.vendorKey,
          ),
          eq(integration_connections.owner_type, ctx.ownerType),
          eq(integration_connections.owner_id, ctx.ownerId),
          eq(integration_connections.status, "active"),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      return {
        ok: false,
        reason: `No active integration_connections row for vendor=${definition.vendorManifest.vendorKey}, owner=${ctx.ownerType}:${ctx.ownerId}.`,
      };
    }
  }

  if (contract.artefacts.activityLog) {
    const kind = contract.artefacts.activityLog;
    const since = Date.now() - ARTEFACT_RECENCY_MS;
    const rows = await db
      .select({ id: activity_log.id })
      .from(activity_log)
      .where(
        and(
          eq(activity_log.kind, kind),
          gte(activity_log.created_at_ms, since),
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      return {
        ok: false,
        reason: `No recent activity_log row with kind=${kind}.`,
      };
    }
  }

  return { ok: true };
}
