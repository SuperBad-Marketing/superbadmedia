/**
 * Suppression + frequency gate for outbound email.
 *
 * `canSendTo()` must be called before every `sendEmail()`. It returns
 * `{ allowed: false, reason }` if:
 *   1. The recipient is in `email_suppressions` (bounce, complaint,
 *      unsubscribe, or manual suppression) — globally or for this
 *      classification specifically.
 *   2. (Future) Frequency caps exceeded — placeholder for Wave 3+ wire-up.
 *
 * Transactional emails (classification = "transactional" or
 * "portal_magic_link_recovery") bypass frequency caps but still honour
 * complaint and bounce suppressions.
 *
 * Owner: A7. Consumer: sendEmail() (same wave), B3 (Resend webhook populates).
 */
import { eq, and, or, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db as globalDb } from "@/lib/db";
import { email_suppressions } from "@/lib/db/schema/email-suppressions";
import type { EmailClassification } from "@/lib/channels/email/classifications";
import { isTransactional } from "@/lib/channels/email/classifications";

export interface CanSendToResult {
  allowed: boolean;
  reason?: string;
}

// Allow tests to inject a different db instance.
// Record<string, unknown> is the inferred schema type when drizzle() is called
// without a schema argument; BetterSQLite3Database<typeof fullSchema> (production)
// is structurally assignable to this.
type AnyDrizzle = BetterSQLite3Database<Record<string, unknown>>;

/**
 * Check whether `recipient` may receive an email of the given `classification`
 * for `purpose`.
 *
 * @param recipient  - Email address to check
 * @param classification - Email classification (16-value enum)
 * @param purpose    - Human-readable purpose string for logging
 * @param dbOverride - Optional DB instance for tests
 */
export async function canSendTo(
  recipient: string,
  classification: EmailClassification,
  purpose: string,
  dbOverride?: AnyDrizzle,
): Promise<CanSendToResult> {
  const resolvedDb = (dbOverride ?? globalDb) as AnyDrizzle;
  const normalised = recipient.trim().toLowerCase();

  // --- Suppression check ---
  // Hard bounce or spam complaint blocks ALL sends (including transactional).
  const hardBlocks = await resolvedDb
    .select({ id: email_suppressions.id, kind: email_suppressions.kind })
    .from(email_suppressions)
    .where(
      and(
        eq(email_suppressions.email, normalised),
        or(
          eq(email_suppressions.kind, "bounce"),
          eq(email_suppressions.kind, "complaint"),
        ),
      ),
    )
    .limit(1);

  if (hardBlocks.length > 0) {
    return {
      allowed: false,
      reason: `email_suppression:${hardBlocks[0].kind} — ${normalised}`,
    };
  }

  // Unsubscribe + manual suppressions block non-transactional sends only.
  if (!isTransactional(classification)) {
    const softBlocks = await resolvedDb
      .select({ id: email_suppressions.id, kind: email_suppressions.kind })
      .from(email_suppressions)
      .where(
        and(
          eq(email_suppressions.email, normalised),
          or(
            eq(email_suppressions.kind, "unsubscribe"),
            eq(email_suppressions.kind, "manual"),
          ),
          // Global suppression (classification IS NULL) OR classification-specific
          or(
            isNull(email_suppressions.classification),
            eq(email_suppressions.classification, classification),
          ),
        ),
      )
      .limit(1);

    if (softBlocks.length > 0) {
      return {
        allowed: false,
        reason: `email_suppression:${softBlocks[0].kind} — ${normalised} (classification=${classification})`,
      };
    }
  }

  // --- Frequency cap placeholder ---
  // Wave 3+ wires per-classification frequency limits here.
  // For now: allow. Log `purpose` so future audit can reconstruct send history.
  void purpose;

  return { allowed: true };
}
