/**
 * Shared-primitive helper for every integration wizard's completion step.
 *
 * Writes a row to `integration_connections` with encrypted credentials
 * (via B2 vault), then calls the Observatory `registerBands()` stub and
 * returns the band names so the celebration step can render the
 * post-completion summary.
 *
 * Kill-switch (`setup_wizards_enabled`) short-circuits by throwing — the
 * celebration orchestrator rolls back by never writing the
 * `wizard_completions` row.
 *
 * Signature deviation from spec §7.2: object-arg form + explicit
 * `ownerType`/`ownerId` (spec's positional form assumed owner lived on
 * `metadata`; object args match codebase convention per `logActivity`
 * and are strictly typed). See SW-3 handoff §"Signature notes".
 *
 * Owner: SW-3. Consumer: every integration wizard's celebration onComplete.
 */
import { randomUUID, createHash } from "node:crypto";
import { db as defaultDb } from "@/lib/db";
import { integration_connections } from "@/lib/db/schema/integration-connections";
import { vault } from "@/lib/crypto/vault";
import { killSwitches } from "@/lib/kill-switches";
import type { VendorManifest } from "@/lib/wizards/types";
import { registerBands, type BandName } from "./registerBands";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = typeof defaultDb | any;

export type RegisterIntegrationInput = {
  wizardCompletionId: string;
  manifest: VendorManifest;
  credentials: { plaintext: string };
  metadata: Record<string, unknown>;
  ownerType: "admin" | "client";
  ownerId: string;
};

export type RegisterIntegrationResult = {
  connectionId: string;
  bandsRegistered: BandName[];
};

function hashBands(manifest: VendorManifest): string {
  const sorted = [...manifest.jobs].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const payload = JSON.stringify({
    vendorKey: manifest.vendorKey,
    jobs: sorted.map((j) => ({
      name: j.name,
      defaultBand: j.defaultBand,
      unit: j.unit,
    })),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function registerIntegration(
  input: RegisterIntegrationInput,
  dbArg?: DbLike,
): Promise<RegisterIntegrationResult> {
  if (!killSwitches.setup_wizards_enabled) {
    throw new Error(
      "setup_wizards_enabled kill-switch is off — refusing to write integration_connections.",
    );
  }

  const db = dbArg ?? defaultDb;
  const { wizardCompletionId, manifest, credentials, metadata, ownerType, ownerId } =
    input;

  const ciphertext = vault.encrypt(
    credentials.plaintext,
    `${manifest.vendorKey}.credentials`,
  );

  const bandsRegistered = await registerBands(manifest.jobs);

  const now = Date.now();
  const connectionId = randomUUID();

  await db.insert(integration_connections).values({
    id: connectionId,
    vendor_key: manifest.vendorKey,
    owner_type: ownerType,
    owner_id: ownerId,
    credentials: ciphertext,
    metadata,
    connection_verified_at_ms: now,
    band_registration_hash: hashBands(manifest),
    status: "active",
    connected_via_wizard_completion_id: wizardCompletionId,
    created_at_ms: now,
    updated_at_ms: now,
  });

  return { connectionId, bandsRegistered };
}
