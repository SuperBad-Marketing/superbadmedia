/**
 * Template CRUD helpers for Quote Builder settings surface (§4.5).
 *
 * A template is a structural scaffold — default sections prose, default
 * line items (as `{ catalogue_item_id, qty, override_price_cents_inc_gst }`
 * references), default term length. It does not carry client-specific
 * content. Templates referenced by any existing quote soft-delete; others
 * hard-delete.
 *
 * v1 — QB-2b ships structure-only editing. Client-specific prose ("what you
 * told us") is never templated.
 */
import { asc, eq, isNull, and } from "drizzle-orm";

import { db as defaultDb } from "@/lib/db";

type DatabaseLike = typeof defaultDb;
import {
  quote_templates,
  type QuoteTemplateRow,
  type QuoteTemplateStructure,
  QUOTE_TEMPLATE_STRUCTURES,
} from "@/lib/db/schema/quote-templates";

function newId(): string {
  const c = globalThis.crypto;
  if (c && "randomUUID" in c) return c.randomUUID();
  return `tmpl_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type TemplateDefaultLineItem = {
  catalogue_item_id: string;
  qty: number;
  /** Optional override of the catalogue's current base price. */
  override_price_cents_inc_gst: number | null;
  kind: "retainer" | "one_off";
};

export type TemplateDefaultSections = {
  whatWellDo_prose?: string;
  terms_overrides_prose?: string;
};

export type QuoteTemplateInput = {
  name: string;
  structure: QuoteTemplateStructure;
  term_length_months: number | null;
  default_sections: TemplateDefaultSections;
  default_line_items: TemplateDefaultLineItem[];
};

export class TemplateValidationError extends Error {}

function validate(input: QuoteTemplateInput): void {
  if (!input.name.trim()) throw new TemplateValidationError("Name required.");
  if (!QUOTE_TEMPLATE_STRUCTURES.includes(input.structure)) {
    throw new TemplateValidationError("Unknown structure.");
  }
  if (input.structure === "retainer" && input.term_length_months == null) {
    throw new TemplateValidationError("Retainer templates need a term length.");
  }
  if (input.term_length_months != null) {
    if (!Number.isInteger(input.term_length_months) || input.term_length_months <= 0) {
      throw new TemplateValidationError("Term length must be a positive integer.");
    }
  }
  for (const li of input.default_line_items) {
    if (!li.catalogue_item_id) {
      throw new TemplateValidationError("Line item missing catalogue reference.");
    }
    if (!Number.isFinite(li.qty) || li.qty <= 0) {
      throw new TemplateValidationError("Line item qty must be positive.");
    }
  }
}

export function listQuoteTemplates(
  options?: { includeDeleted?: boolean },
  dbOverride?: DatabaseLike,
): QuoteTemplateRow[] {
  const database = dbOverride ?? defaultDb;
  return database
    .select()
    .from(quote_templates)
    .where(options?.includeDeleted ? undefined : isNull(quote_templates.deleted_at_ms))
    .orderBy(asc(quote_templates.structure), asc(quote_templates.name))
    .all();
}

export function getQuoteTemplate(
  id: string,
  dbOverride?: DatabaseLike,
): QuoteTemplateRow | null {
  const database = dbOverride ?? defaultDb;
  return (
    database
      .select()
      .from(quote_templates)
      .where(eq(quote_templates.id, id))
      .get() ?? null
  );
}

export function createQuoteTemplate(
  input: QuoteTemplateInput,
  dbOverride?: DatabaseLike,
): QuoteTemplateRow {
  validate(input);
  const database = dbOverride ?? defaultDb;
  const now = Date.now();
  const id = newId();
  database.insert(quote_templates)
    .values({
      id,
      name: input.name.trim(),
      structure: input.structure,
      term_length_months: input.term_length_months,
      default_sections_json: input.default_sections,
      default_line_items_json: input.default_line_items,
      usage_count: 0,
      created_at_ms: now,
      updated_at_ms: now,
      deleted_at_ms: null,
    })
    .run();
  const row = getQuoteTemplate(id, database);
  if (!row) throw new Error("Failed to read back inserted template.");
  return row;
}

export function updateQuoteTemplate(
  id: string,
  input: QuoteTemplateInput,
  dbOverride?: DatabaseLike,
): QuoteTemplateRow {
  validate(input);
  const database = dbOverride ?? defaultDb;
  const existing = getQuoteTemplate(id, database);
  if (!existing) throw new TemplateValidationError("Template not found.");
  if (existing.deleted_at_ms != null) {
    throw new TemplateValidationError("Cannot edit a deleted template.");
  }
  database.update(quote_templates)
    .set({
      name: input.name.trim(),
      structure: input.structure,
      term_length_months: input.term_length_months,
      default_sections_json: input.default_sections,
      default_line_items_json: input.default_line_items,
      updated_at_ms: Date.now(),
    })
    .where(eq(quote_templates.id, id))
    .run();
  const row = getQuoteTemplate(id, database);
  if (!row) throw new Error("Failed to read back updated template.");
  return row;
}

/**
 * Soft delete always (cheap and safe). "Hard delete when no quotes reference
 * the template" per §4.5 is deferred — we don't yet stamp quotes with their
 * template id, so every delete is effectively soft. Row stays queryable via
 * `includeDeleted` for audit.
 */
export function softDeleteQuoteTemplate(id: string, dbOverride?: DatabaseLike): void {
  const database = dbOverride ?? defaultDb;
  const existing = getQuoteTemplate(id, database);
  if (!existing) throw new TemplateValidationError("Template not found.");
  if (existing.deleted_at_ms != null) return;
  database.update(quote_templates)
    .set({ deleted_at_ms: Date.now(), updated_at_ms: Date.now() })
    .where(and(eq(quote_templates.id, id), isNull(quote_templates.deleted_at_ms)))
    .run();
}
