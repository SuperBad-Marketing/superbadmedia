/**
 * Content Engine — newsletter subscriber list management (CE-11).
 *
 * Spec: docs/specs/content-engine.md §4.2 (list management), §4.3 (hygiene),
 * §8.1 (List tab).
 *
 * Queries for: listing subscribers, CSV import (with permission-pass consent
 * source), health stats (bounce/unsub/inactive rates), CSV export (all contacts
 * including removed with status column).
 *
 * Owner: CE-11. Consumers: List tab page + server actions.
 */
import { eq, desc } from "drizzle-orm";
import { db as defaultDb } from "@/lib/db";
import {
  newsletterSubscribers,
  type NewsletterSubscriberRow,
  type NewsletterConsentSource,
} from "@/lib/db/schema/newsletter-subscribers";
import { logActivity } from "@/lib/activity-log";
import { randomUUID } from "crypto";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SubscriberListItem {
  id: string;
  email: string;
  name: string | null;
  consentSource: NewsletterConsentSource;
  status: NewsletterSubscriberRow["status"];
  bounceCount: number;
  lastOpenedAtMs: number | null;
  createdAtMs: number;
}

export interface ListHealthStats {
  total: number;
  active: number;
  pendingConfirmation: number;
  bounced: number;
  unsubscribed: number;
  inactiveRemoved: number;
  bounceRate: number;
  unsubscribeRate: number;
  inactiveRate: number;
  recentRemovals: Array<{
    email: string;
    status: NewsletterSubscriberRow["status"];
    removedAtMs: number | null;
  }>;
}

export interface CsvImportResult {
  ok: true;
  imported: number;
  skipped: number;
  duplicates: number;
}

export interface CsvExportRow {
  email: string;
  name: string;
  consent_source: string;
  status: string;
  subscribed_at: string;
  unsubscribed_at: string;
  removed_at: string;
}

// ── List query ──────────────────────────────────────────────────────────────

/**
 * List all subscribers for a company, ordered by newest first.
 */
export async function listSubscribers(
  companyId: string,
  opts?: { db?: typeof defaultDb },
): Promise<SubscriberListItem[]> {
  const database = opts?.db ?? defaultDb;
  const rows = await database
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.company_id, companyId))
    .orderBy(desc(newsletterSubscribers.created_at_ms))
    .all();

  return rows.map(toListItem);
}

// ── Health stats ────────────────────────────────────────────────────────────

/**
 * Compute list health stats for a company's subscriber list.
 * Spec §4.3: bounce rate, unsubscribe rate, inactive %, recent removals.
 */
export async function getListHealth(
  companyId: string,
  opts?: { db?: typeof defaultDb },
): Promise<ListHealthStats> {
  const database = opts?.db ?? defaultDb;

  const rows = await database
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.company_id, companyId))
    .all();

  const total = rows.length;
  const active = rows.filter((r) => r.status === "active").length;
  const pendingConfirmation = rows.filter(
    (r) => r.status === "pending_confirmation",
  ).length;
  const bounced = rows.filter((r) => r.status === "bounced").length;
  const unsubscribed = rows.filter((r) => r.status === "unsubscribed").length;
  const inactiveRemoved = rows.filter(
    (r) => r.status === "inactive_removed",
  ).length;

  // Rates as percentages of total (0 if no subscribers)
  const bounceRate = total > 0 ? (bounced / total) * 100 : 0;
  const unsubscribeRate = total > 0 ? (unsubscribed / total) * 100 : 0;
  const inactiveRate = total > 0 ? (inactiveRemoved / total) * 100 : 0;

  // Recent removals: bounced, unsubscribed, or inactive_removed with a
  // removed_at or unsubscribed_at timestamp. Last 10, newest first.
  const removed = rows
    .filter(
      (r) =>
        r.status === "bounced" ||
        r.status === "unsubscribed" ||
        r.status === "inactive_removed",
    )
    .sort(
      (a, b) =>
        (b.removed_at_ms ?? b.unsubscribed_at_ms ?? 0) -
        (a.removed_at_ms ?? a.unsubscribed_at_ms ?? 0),
    )
    .slice(0, 10);

  return {
    total,
    active,
    pendingConfirmation,
    bounced,
    unsubscribed,
    inactiveRemoved,
    bounceRate: Math.round(bounceRate * 10) / 10,
    unsubscribeRate: Math.round(unsubscribeRate * 10) / 10,
    inactiveRate: Math.round(inactiveRate * 10) / 10,
    recentRemovals: removed.map((r) => ({
      email: r.email,
      status: r.status,
      removedAtMs: r.removed_at_ms ?? r.unsubscribed_at_ms,
    })),
  };
}

// ── CSV import ──────────────────────────────────────────────────────────────

/**
 * Import subscribers from parsed CSV rows.
 *
 * Spec §4.2: CSV import with mandatory permission pass. Imported contacts
 * start as `pending_confirmation` with `consent_source: 'csv_import'`.
 * Duplicates (same email for same company) are skipped.
 */
export async function importSubscribersFromCsv(
  companyId: string,
  rows: Array<{ email: string; name?: string }>,
  opts?: { db?: typeof defaultDb },
): Promise<CsvImportResult> {
  const database = opts?.db ?? defaultDb;
  const nowMs = Date.now();

  // Get existing emails for dedup
  const existing = await database
    .select({ email: newsletterSubscribers.email })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.company_id, companyId))
    .all();
  const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()));

  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();

    // Basic email validation
    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }

    // Dedup
    if (existingEmails.has(email)) {
      duplicates++;
      continue;
    }

    await database.insert(newsletterSubscribers).values({
      id: randomUUID(),
      company_id: companyId,
      email,
      name: row.name?.trim() || null,
      consent_source: "csv_import",
      consented_at_ms: nowMs,
      status: "pending_confirmation",
      bounce_count: 0,
      created_at_ms: nowMs,
    });

    existingEmails.add(email);
    imported++;
  }

  await logActivity({
    companyId,
    kind: "content_subscriber_added",
    body: `CSV import: ${imported} imported, ${duplicates} duplicates, ${skipped} invalid.`,
    meta: { imported, skipped, duplicates, source: "csv_import" },
  });

  return { ok: true, imported, skipped, duplicates };
}

// ── CSV export ──────────────────────────────────────────────────────────────

/**
 * Export all subscribers (including removed) as CSV string.
 * Spec §4.3: "Full CSV export available: all contacts including removed,
 * with status column."
 */
export async function exportSubscribersCsv(
  companyId: string,
  opts?: { db?: typeof defaultDb },
): Promise<string> {
  const database = opts?.db ?? defaultDb;
  const rows = await database
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.company_id, companyId))
    .orderBy(desc(newsletterSubscribers.created_at_ms))
    .all();

  const header = "email,name,consent_source,status,subscribed_at,unsubscribed_at,removed_at";
  const csvRows = rows.map((r) => {
    const subscribedAt = new Date(r.consented_at_ms).toISOString();
    const unsubscribedAt = r.unsubscribed_at_ms
      ? new Date(r.unsubscribed_at_ms).toISOString()
      : "";
    const removedAt = r.removed_at_ms
      ? new Date(r.removed_at_ms).toISOString()
      : "";
    return [
      escapeCsv(r.email),
      escapeCsv(r.name ?? ""),
      r.consent_source,
      r.status,
      subscribedAt,
      unsubscribedAt,
      removedAt,
    ].join(",");
  });

  return [header, ...csvRows].join("\n");
}

// ── Embed form token ────────────────────────────────────────────────────────

/**
 * Generate the embeddable opt-in form HTML snippet.
 * Uses the company's embed_form_token from content_engine_config.
 */
export function generateEmbedCode(
  baseUrl: string,
  embedFormToken: string,
): string {
  const endpoint = `${baseUrl}/api/newsletter/subscribe`;
  return [
    `<form action="${endpoint}" method="POST" style="display:flex;gap:8px;max-width:400px;">`,
    `  <input type="hidden" name="token" value="${embedFormToken}" />`,
    `  <input type="email" name="email" placeholder="Your email" required`,
    `    style="flex:1;padding:8px 12px;border:1px solid #d4d4d4;border-radius:6px;font-size:14px;" />`,
    `  <button type="submit"`,
    `    style="padding:8px 16px;background:#171717;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;">`,
    `    Subscribe`,
    `  </button>`,
    `</form>`,
  ].join("\n");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toListItem(row: NewsletterSubscriberRow): SubscriberListItem {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    consentSource: row.consent_source,
    status: row.status,
    bounceCount: row.bounce_count,
    lastOpenedAtMs: row.last_opened_at_ms,
    createdAtMs: row.created_at_ms,
  };
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
