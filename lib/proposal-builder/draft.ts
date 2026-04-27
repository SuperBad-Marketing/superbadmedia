/**
 * Proposal draft CRUD — create, update, list proposals.
 */

import { db } from "@/lib/db";
import { proposals, type ProposalRow } from "@/lib/db/schema/proposals";
import { eq, desc } from "drizzle-orm";
import type { ProposalSection } from "./content-shape";

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

function generateProposalNumber(): string {
  const year = new Date().getFullYear();
  const existing = db
    .select({ proposal_number: proposals.proposal_number })
    .from(proposals)
    .all();

  const prefix = `SBP-${year}-`;
  const currentYearNumbers = existing
    .filter((r) => r.proposal_number.startsWith(prefix))
    .map((r) => parseInt(r.proposal_number.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));

  const next = currentYearNumbers.length > 0 ? Math.max(...currentYearNumbers) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export function createDraftProposal(opts: {
  title: string;
  subtitle?: string;
  clientName: string;
  companyId?: string;
  dealId?: string;
  primaryContactId?: string;
  sections: ProposalSection[];
  userId?: string;
}): ProposalRow {
  const now = Date.now();
  const id = crypto.randomUUID();

  const row = {
    id,
    token: generateToken(),
    proposal_number: generateProposalNumber(),
    title: opts.title,
    subtitle: opts.subtitle ?? null,
    client_name: opts.clientName,
    company_id: opts.companyId ?? null,
    deal_id: opts.dealId ?? null,
    primary_contact_id: opts.primaryContactId ?? null,
    sections_json: opts.sections as unknown,
    status: "draft" as const,
    created_by_user_id: opts.userId ?? null,
    last_edited_by_user_id: opts.userId ?? null,
    pdf_cache_key: null,
    sent_at_ms: null,
    viewed_at_ms: null,
    accepted_at_ms: null,
    withdrawn_at_ms: null,
    expires_at_ms: null,
    created_at_ms: now,
    updated_at_ms: now,
  };

  db.insert(proposals).values(row).run();
  return row as ProposalRow;
}

export function updateProposalSections(
  proposalId: string,
  sections: ProposalSection[],
  userId?: string,
): void {
  db.update(proposals)
    .set({
      sections_json: sections as unknown,
      last_edited_by_user_id: userId ?? null,
      updated_at_ms: Date.now(),
    })
    .where(eq(proposals.id, proposalId))
    .run();
}

export function updateProposalMeta(
  proposalId: string,
  updates: {
    title?: string;
    subtitle?: string;
    clientName?: string;
    companyId?: string;
    dealId?: string;
  },
): void {
  const set: Record<string, unknown> = { updated_at_ms: Date.now() };
  if (updates.title !== undefined) set.title = updates.title;
  if (updates.subtitle !== undefined) set.subtitle = updates.subtitle;
  if (updates.clientName !== undefined) set.client_name = updates.clientName;
  if (updates.companyId !== undefined) set.company_id = updates.companyId;
  if (updates.dealId !== undefined) set.deal_id = updates.dealId;

  db.update(proposals).set(set).where(eq(proposals.id, proposalId)).run();
}

export function getProposal(proposalId: string): ProposalRow | undefined {
  return db.select().from(proposals).where(eq(proposals.id, proposalId)).get();
}

export function getProposalByToken(token: string): ProposalRow | undefined {
  return db.select().from(proposals).where(eq(proposals.token, token)).get();
}

export function listProposals(): ProposalRow[] {
  return db
    .select()
    .from(proposals)
    .orderBy(desc(proposals.created_at_ms))
    .all();
}
