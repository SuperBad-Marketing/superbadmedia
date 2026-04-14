import { desc, eq, lte, and } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  legal_doc_versions,
  type LegalDocType,
  type LegalDocVersionRow,
} from "@/lib/db/schema/legal-doc-versions";

type DatabaseLike = typeof defaultDb;

/**
 * Current effective version for a legal document type — the most recent
 * row with `effective_from_ms <= now`. Returns null when no row is
 * seeded (dev/test environments before the B3 seed migration has run).
 *
 * QB-4c consumer: acceptQuote() stamps the returned IDs onto the quote
 * row so we know which legal text the client saw. §13 compliance sweep.
 */
export async function getCurrentLegalVersion(
  doc_type: LegalDocType,
  opts: { nowMs?: number; db?: DatabaseLike } = {},
): Promise<LegalDocVersionRow | null> {
  const now = opts.nowMs ?? Date.now();
  const database = opts.db ?? defaultDb;
  const row = await database
    .select()
    .from(legal_doc_versions)
    .where(
      and(
        eq(legal_doc_versions.doc_type, doc_type),
        lte(legal_doc_versions.effective_from_ms, now),
      ),
    )
    .orderBy(desc(legal_doc_versions.effective_from_ms))
    .limit(1);
  return row[0] ?? null;
}

export interface CurrentLegalVersions {
  tos: LegalDocVersionRow | null;
  privacy: LegalDocVersionRow | null;
}

/** Convenience: both IDs the client tickbox commits to. */
export async function getCurrentQuoteLegalVersions(
  opts: { nowMs?: number; db?: DatabaseLike } = {},
): Promise<CurrentLegalVersions> {
  const [tos, privacy] = await Promise.all([
    getCurrentLegalVersion("terms_of_service", opts),
    getCurrentLegalVersion("privacy_policy", opts),
  ]);
  return { tos, privacy };
}
