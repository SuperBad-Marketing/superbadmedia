/**
 * @egg milestone_spotter
 * @register admin-roommate
 * @reads
 *   - activity_log (kind='note', body, meta, company_id, contact_id) WHERE created_at_ms >= now() - 24h (event-driven)
 *   - activity_log (kind='note', body, meta, company_id, contact_id) WHERE created_at_ms >= now() - 12mo (daily sweep)
 *   - contacts (id, first_name, last_name, notes)
 *   - companies (id, name, notes)
 *   - deals (id, stage, company_id) — to check lost/dead exclusion
 *   - hidden_egg_fires (egg_id='milestone_spotter', user_id, trigger_evidence) — 60d per-contact dedup
 * @does_not_read
 *   - brand_dna_profiles, context_summaries, messages, quotes, invoices
 *   - any client portal data
 * @cross_client_inference false
 * @evidence_fields [contactId, companyId, eventType, eventDate, sourceNoteId, sourceText]
 */

import { db } from "@/lib/db";
import { activity_log } from "@/lib/db/schema/activity-log";
import { hidden_egg_fires } from "@/lib/db/schema/hidden-egg-fires";
import { contacts } from "@/lib/db/schema/contacts";
import { companies } from "@/lib/db/schema/companies";
import { deals } from "@/lib/db/schema/deals";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { invokeLlmText } from "@/lib/ai/invoke";
import { killSwitches } from "@/lib/kill-switches";

const PER_CONTACT_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;
const STALE_NOTE_CUTOFF_MS = 12 * 30 * 24 * 60 * 60 * 1000;
const UPCOMING_WINDOW_DAYS = 14;
const PAST_GRACE_DAYS = 3;
const LOST_STAGES = ["lost"] as const;

export interface DetectedMilestone {
  contactId: string | null;
  companyId: string | null;
  contactName: string | null;
  companyName: string | null;
  eventType: string;
  eventDate: string;
  dateConfidence: "exact" | "approximate";
  sourceNoteId: string;
  sourceText: string;
  draftMessage: string | null;
}

export async function scanForMilestones(
  nowMs: number = Date.now(),
  lookbackMs: number = 24 * 60 * 60 * 1000,
): Promise<DetectedMilestone[]> {
  if (!killSwitches.llm_calls_enabled) return [];

  const cutoffMs = nowMs - lookbackMs;
  const notes = await db
    .select({
      id: activity_log.id,
      body: activity_log.body,
      meta: activity_log.meta,
      contact_id: activity_log.contact_id,
      company_id: activity_log.company_id,
      created_at_ms: activity_log.created_at_ms,
    })
    .from(activity_log)
    .where(
      and(eq(activity_log.kind, "note"), gte(activity_log.created_at_ms, cutoffMs)),
    );

  if (notes.length === 0) return [];

  const contactIds = [
    ...new Set(notes.map((n) => n.contact_id).filter(Boolean) as string[]),
  ];

  const recentFires = contactIds.length > 0
    ? await db
        .select({
          trigger_evidence: hidden_egg_fires.trigger_evidence,
        })
        .from(hidden_egg_fires)
        .where(
          and(
            eq(hidden_egg_fires.egg_id, "milestone_spotter"),
            gte(hidden_egg_fires.fired_at_ms, nowMs - PER_CONTACT_COOLDOWN_MS),
          ),
        )
    : [];

  const recentContactIds = new Set(
    recentFires
      .map((f) => {
        const ev = f.trigger_evidence as Record<string, unknown>;
        return (ev?.contactId as string) ?? null;
      })
      .filter(Boolean),
  );

  const lostDealCompanyIds = new Set<string>();
  if (contactIds.length > 0) {
    const contactRows = await db
      .select({ company_id: contacts.company_id })
      .from(contacts)
      .where(inArray(contacts.id, contactIds));
    const companyIds = [
      ...new Set(contactRows.map((c) => c.company_id).filter(Boolean) as string[]),
    ];
    if (companyIds.length > 0) {
      const lostDeals = await db
        .select({ company_id: deals.company_id })
        .from(deals)
        .where(
          and(
            inArray(deals.company_id, companyIds),
            eq(deals.stage, "lost"),
          ),
        );
      for (const d of lostDeals) {
        if (d.company_id) lostDealCompanyIds.add(d.company_id);
      }
    }
  }

  const milestones: DetectedMilestone[] = [];

  for (const note of notes) {
    if (!note.body || note.body.trim().length < 10) continue;

    if (note.contact_id && recentContactIds.has(note.contact_id)) continue;

    const noteAgeMs = nowMs - note.created_at_ms;
    if (noteAgeMs > STALE_NOTE_CUTOFF_MS) continue;

    const extracted = await extractMilestone(note.body, nowMs);
    if (!extracted) continue;

    if (extracted.daysUntil < -PAST_GRACE_DAYS) continue;
    if (extracted.daysUntil > UPCOMING_WINDOW_DAYS) continue;

    let contactName: string | null = null;
    let companyName: string | null = null;

    if (note.contact_id) {
      const [row] = await db
        .select({ name: contacts.name, company_id: contacts.company_id })
        .from(contacts)
        .where(eq(contacts.id, note.contact_id))
        .limit(1);
      if (row) {
        contactName = row.name || null;
        if (row.company_id && lostDealCompanyIds.has(row.company_id)) continue;
      }
    }

    if (note.company_id) {
      if (lostDealCompanyIds.has(note.company_id)) continue;
      const [row] = await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, note.company_id))
        .limit(1);
      if (row) companyName = row.name;
    }

    milestones.push({
      contactId: note.contact_id,
      companyId: note.company_id,
      contactName,
      companyName,
      eventType: extracted.eventType,
      eventDate: extracted.eventDate,
      dateConfidence: extracted.dateConfidence,
      sourceNoteId: note.id,
      sourceText: note.body,
      draftMessage: null,
    });
  }

  return milestones;
}

interface ExtractedMilestone {
  eventType: string;
  eventDate: string;
  dateConfidence: "exact" | "approximate";
  daysUntil: number;
}

async function extractMilestone(
  noteText: string,
  nowMs: number,
): Promise<ExtractedMilestone | null> {
  const todayISO = new Date(nowMs).toISOString().split("T")[0];
  const prompt = `You are a milestone detector. Given a note about a business contact, extract any personal or business milestone (birthday, anniversary, founding date, funding round, office move, award, or any event with a specific upcoming date).

Today's date: ${todayISO}

Note text:
"""
${noteText}
"""

If a milestone is found, respond with JSON only:
{"eventType":"<type>","eventDate":"YYYY-MM-DD","dateConfidence":"exact"|"approximate"}

If the date is ambiguous (e.g. "sometime in April"), use the 1st of the month and set confidence to "approximate".
If no milestone is found, respond with: null`;

  const raw = await invokeLlmText({
    job: "sd-milestone-extract",
    prompt,
    maxTokens: 200,
  });

  const trimmed = raw.trim();
  if (trimmed === "null" || trimmed === "") return null;

  try {
    const parsed = JSON.parse(trimmed) as {
      eventType?: string;
      eventDate?: string;
      dateConfidence?: string;
    };
    if (!parsed.eventType || !parsed.eventDate) return null;

    const eventMs = new Date(parsed.eventDate).getTime();
    if (isNaN(eventMs)) return null;

    const daysUntil = Math.floor((eventMs - nowMs) / (24 * 60 * 60 * 1000));

    return {
      eventType: parsed.eventType,
      eventDate: parsed.eventDate,
      dateConfidence: parsed.dateConfidence === "approximate" ? "approximate" : "exact",
      daysUntil,
    };
  } catch {
    return null;
  }
}

export async function generateMilestoneDraft(
  milestone: DetectedMilestone,
): Promise<string> {
  const name = milestone.contactName ?? milestone.companyName ?? "them";
  const prompt = `Write a very short, warm, personal message from Andy at SuperBad Marketing acknowledging this milestone. Dry humor welcome, keep it brief (2-3 sentences max). No templates, no corporate tone.

Milestone: ${milestone.eventType}
Date: ${milestone.eventDate}${milestone.dateConfidence === "approximate" ? " (approximate)" : ""}
Person/company: ${name}
Source note: "${milestone.sourceText}"

Write the message only, no subject line, no greeting.`;

  return invokeLlmText({
    job: "sd-milestone-draft",
    prompt,
    maxTokens: 300,
  });
}
