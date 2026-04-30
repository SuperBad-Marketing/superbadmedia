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

export function toE164(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/[^\d+]/g, "");
    return digits.length >= 10 ? digits : null;
  }
  const digits = trimmed.replace(/\D+/g, "");
  if (digits.length === 0) return null;
  if (digits.startsWith("04") && digits.length === 10) return `+61${digits.slice(1)}`;
  if (digits.startsWith("02") && digits.length === 10) return `+61${digits.slice(1)}`;
  if (digits.startsWith("03") && digits.length === 10) return `+61${digits.slice(1)}`;
  if (digits.startsWith("07") && digits.length === 10) return `+61${digits.slice(1)}`;
  if (digits.startsWith("08") && digits.length === 10) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("614") && digits.length === 11) return `+${digits}`;
  return `+${digits}`;
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
