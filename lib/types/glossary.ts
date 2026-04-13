/**
 * Canonical TypeScript types for SuperBad Lite's named entities.
 * Source of truth: `FOUNDATIONS.md` §13 Glossary.
 *
 * Every feature imports from here. Non-canonical terms (Customer,
 * Proposal in code, SaaS client, etc.) are patched on sight per §13.
 *
 * These are branded string aliases — the concrete row shapes live in
 * `lib/db/schema/*` and are re-derived from Drizzle. These types exist
 * so business-logic signatures express intent (`toProspect(contactId)`
 * reads clearly; `toContact(contactId)` does not).
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

// Identifiers — opaque row IDs, not for the database layer.
export type ContactId = Brand<string, "ContactId">;
export type CompanyId = Brand<string, "CompanyId">;
export type DealId = Brand<string, "DealId">;
export type QuoteId = Brand<string, "QuoteId">;
export type InvoiceId = Brand<string, "InvoiceId">;

// Business lifecycle — a Contact's relationship to SuperBad.
// These are role-like views over the same underlying contact row.
export type Lead = Brand<ContactId, "Lead">;
export type Prospect = Brand<ContactId, "Prospect">;
export type Client = Brand<ContactId, "Client">;
export type Subscriber = Brand<ContactId, "Subscriber">;

// Underlying person + company records.
export type Contact = Brand<ContactId, "Contact">;
export type Company = Brand<CompanyId, "Company">;

// Sales artefacts.
export type Deal = Brand<DealId, "Deal">;
export type Quote = Brand<QuoteId, "Quote">;
export type Invoice = Brand<InvoiceId, "Invoice">;

// Hiring.
export type Candidate = Brand<string, "Candidate">;
export type Hire = Brand<string, "Hire">;

/**
 * Onboarding entry paths (FOUNDATIONS.md §13 F4.c lock).
 * Trial-shoot graduates bypass Onboarding §8.1 welcome screen.
 */
export type OnboardingEntryPath =
  | "trial-shoot-graduate"
  | "direct-referral"
  | "legacy";
