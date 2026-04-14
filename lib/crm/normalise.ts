/**
 * Deterministic normalisation for contact dedupe (sales-pipeline §10.4).
 * Runs on every write; the normalised values live in their own columns
 * (`contacts.email_normalised`, `contacts.phone_normalised`,
 * `companies.name_normalised`) and are indexed for fast dedupe lookups.
 */

export function normaliseEmail(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length === 0 ? null : trimmed;
}

export function normalisePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const digits = raw.replace(/\D+/g, "");
  return digits.length === 0 ? null : digits;
}

export function normaliseCompanyName(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const squeezed = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,'"!?]/g, "");
  return squeezed.length === 0 ? null : squeezed;
}

export function normaliseDomain(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  return stripped.length === 0 ? null : stripped;
}
