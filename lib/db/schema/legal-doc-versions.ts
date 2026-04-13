import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Reference table tracking published versions of legal documents (privacy
 * policy, terms of service, client agreement, subscriber ToS, etc.).
 *
 * Used by:
 *   - Portal auth flow — verify client has accepted the current version
 *   - SaaS billing — subscriber acceptance on signup
 *   - Compliance sweep (FOUNDATIONS §13 legal/compliance)
 *
 * Owner: A7. Consumer: portal (A8+), SaaS (Wave 5+).
 */
export const LEGAL_DOC_TYPES = [
  "privacy_policy",
  "terms_of_service",
  "client_agreement",
  "subscriber_tos",
  "cookie_policy",
  // Added B3 — /lite/legal/acceptable-use page
  "acceptable_use",
] as const;

export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

export const legal_doc_versions = sqliteTable(
  "legal_doc_versions",
  {
    id: text("id").primaryKey(),
    doc_type: text("doc_type", { enum: LEGAL_DOC_TYPES }).notNull(),
    version: text("version").notNull(),
    effective_from_ms: integer("effective_from_ms").notNull(),
    sha256: text("sha256"),
    notes: text("notes"),
    created_at_ms: integer("created_at_ms").notNull(),
  },
  (t) => ({
    by_doc_type: index("legal_doc_versions_type_idx").on(
      t.doc_type,
      t.effective_from_ms,
    ),
  }),
);

export type LegalDocVersionRow = typeof legal_doc_versions.$inferSelect;
export type LegalDocVersionInsert = typeof legal_doc_versions.$inferInsert;
