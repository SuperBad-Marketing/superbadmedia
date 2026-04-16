/**
 * Inbound router classifier — Haiku-tier LLM call per spec §7.1 (Q5).
 *
 * Classifies inbound messages as match_existing / new_lead / non_client /
 * spam. Resolves or creates contacts. Wired into the delta sync pipeline
 * (sync.ts) for inbound messages only.
 *
 * Gated by `inbox_sync_enabled` + `llm_calls_enabled` kill switches.
 * When either is off, returns a fallback result with no side effects.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema/messages";
import { threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { companies, type CompanyInsert } from "@/lib/db/schema/companies";
import { killSwitches } from "@/lib/kill-switches";
import { logActivity } from "@/lib/activity-log";
import { invokeLlmText } from "@/lib/ai/invoke";
import { normaliseEmail, normaliseCompanyName } from "@/lib/crm/normalise";
import type { NormalizedMessage } from "./normalize";
import { loadRouterPromptContext, buildRouterPrompt } from "./router-prompt";

// ── Output schema ────────────────────────────────────────────────────

export const RouterOutputSchema = z.object({
  classification: z.enum(["match_existing", "new_lead", "non_client", "spam"]),
  contact_id: z.string().nullable(),
  new_contact_fields: z
    .object({
      first_name: z.string().optional().default(""),
      last_name: z.string().optional().default(""),
      email: z.string().optional().default(""),
      company_name: z.string().optional().default(""),
      relationship_type: z
        .enum(["lead", "non_client", "supplier", "personal"])
        .optional()
        .default("lead"),
      tag: z.string().optional().default(""),
    })
    .nullable(),
  detected_alt_email: z.string().nullable().optional().default(null),
  reason: z.string(),
});

export type RouterOutput = z.infer<typeof RouterOutputSchema>;

export interface RouterResult {
  classification: RouterOutput["classification"];
  contactId: string | null;
  reason: string;
  skipped: boolean;
}

const SPAM_KEEP_DAYS = 7;

// ── Main entry point ─────────────────────────────────────────────────

export async function classifyAndRouteInbound(
  msg: NormalizedMessage,
  messageId: string,
  threadId: string,
): Promise<RouterResult> {
  if (!killSwitches.inbox_sync_enabled || !killSwitches.llm_calls_enabled) {
    return {
      classification: "new_lead",
      contactId: null,
      reason: "skipped (kill switch)",
      skipped: true,
    };
  }

  const ctx = await loadRouterPromptContext(msg);
  const prompt = buildRouterPrompt(ctx);

  let parsed: RouterOutput;
  try {
    const text = await invokeLlmText({
      job: "inbox-classify-inbound-route",
      prompt,
      maxTokens: 256,
    });
    const json = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    parsed = RouterOutputSchema.parse(JSON.parse(json));
  } catch (err) {
    // LLM or parse failure — fall back to new_lead so nothing is silently dropped
    console.error("[router] Classification failed, falling back to new_lead:", err);
    await updateMessageClassification(messageId, "new_lead", "fallback — LLM/parse error");
    return {
      classification: "new_lead",
      contactId: null,
      reason: "fallback — LLM/parse error",
      skipped: false,
    };
  }

  // Store classification on the message row
  await updateMessageClassification(messageId, parsed.classification, parsed.reason);

  // Apply effects per classification
  let contactId: string | null = null;

  switch (parsed.classification) {
    case "match_existing":
      contactId = await handleMatchExisting(parsed, msg, threadId);
      break;
    case "new_lead":
      contactId = await handleNewContact(parsed, msg, threadId, "lead");
      break;
    case "non_client":
      contactId = await handleNewContact(
        parsed,
        msg,
        threadId,
        parsed.new_contact_fields?.relationship_type ?? "non_client",
      );
      break;
    case "spam":
      await handleSpam(threadId);
      break;
  }

  // Log activity
  await logActivity({
    companyId: null,
    contactId,
    kind: "inbox_routed",
    body: `Inbound email classified as ${parsed.classification}: ${parsed.reason}`,
    meta: {
      classification: parsed.classification,
      message_id: messageId,
      thread_id: threadId,
      reason: parsed.reason,
    },
  });

  return {
    classification: parsed.classification,
    contactId,
    reason: parsed.reason,
    skipped: false,
  };
}

// ── Effect handlers ──────────────────────────────────────────────────

async function updateMessageClassification(
  messageId: string,
  classification: RouterOutput["classification"],
  reason: string,
): Promise<void> {
  await db
    .update(messages)
    .set({
      router_classification: classification,
      router_reason: reason,
      updated_at_ms: Date.now(),
    })
    .where(eq(messages.id, messageId));
}

async function handleMatchExisting(
  parsed: RouterOutput,
  msg: NormalizedMessage,
  threadId: string,
): Promise<string | null> {
  const contactId = parsed.contact_id;
  if (!contactId) return null;

  // Link thread to contact
  await db
    .update(threads)
    .set({ contact_id: contactId, updated_at_ms: Date.now() })
    .where(eq(threads.id, threadId));

  // Detect alt email
  if (parsed.detected_alt_email) {
    const altEmail = normaliseEmail(parsed.detected_alt_email);
    if (altEmail) {
      const contact = await db
        .select({ inbox_alt_emails: contacts.inbox_alt_emails })
        .from(contacts)
        .where(eq(contacts.id, contactId))
        .get();

      if (contact) {
        const existing: string[] = (contact.inbox_alt_emails as string[] | null) ?? [];
        if (!existing.includes(altEmail)) {
          await db
            .update(contacts)
            .set({
              inbox_alt_emails: [...existing, altEmail],
              updated_at_ms: Date.now(),
            })
            .where(eq(contacts.id, contactId));
        }
      }
    }
  }

  return contactId;
}

async function handleNewContact(
  parsed: RouterOutput,
  msg: NormalizedMessage,
  threadId: string,
  relationshipType: string,
): Promise<string | null> {
  const fields = parsed.new_contact_fields;
  const email = fields?.email || msg.from_address;
  const emailNorm = normaliseEmail(email);

  // Check for existing contact by email to avoid duplicates
  if (emailNorm) {
    const existing = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.email_normalised, emailNorm))
      .get();

    if (existing) {
      // Already exists — link thread and return
      await db
        .update(threads)
        .set({ contact_id: existing.id, updated_at_ms: Date.now() })
        .where(eq(threads.id, threadId));
      return existing.id;
    }
  }

  // Resolve or create company
  const companyName = fields?.company_name || "Unknown";
  const companyNameNorm = normaliseCompanyName(companyName);
  let companyId: string | null = null;

  if (companyNameNorm) {
    const existingCompany = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name_normalised, companyNameNorm))
      .get();

    if (existingCompany) {
      companyId = existingCompany.id;
    }
  }

  if (!companyId) {
    companyId = randomUUID();
    const nowMs = Date.now();
    const insert: CompanyInsert = {
      id: companyId,
      name: companyName,
      name_normalised: companyNameNorm ?? companyName.trim().toLowerCase(),
      domain: null,
      industry: null,
      size_band: null,
      billing_mode: "stripe",
      do_not_contact: false,
      notes: null,
      trial_shoot_status: "none",
      shape: null,
      first_seen_at_ms: nowMs,
      created_at_ms: nowMs,
      updated_at_ms: nowMs,
    };
    await db.insert(companies).values(insert);
  }

  // Create contact
  const contactId = randomUUID();
  const nowMs = Date.now();
  const contactName = [fields?.first_name, fields?.last_name]
    .filter(Boolean)
    .join(" ") || email;

  await db.insert(contacts).values({
    id: contactId,
    company_id: companyId,
    name: contactName,
    role: fields?.tag || null,
    email,
    email_normalised: emailNorm,
    email_status: "unknown",
    phone: null,
    phone_normalised: null,
    is_primary: true,
    notes: fields?.tag ? `Auto-created by inbox router: ${fields.tag}` : "Auto-created by inbox router",
    stripe_customer_id: null,
    relationship_type: relationshipType as "lead" | "non_client" | "supplier" | "personal",
    inbox_alt_emails: [],
    notification_weight: 0,
    always_keep_noise: false,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
  });

  // Link thread to contact and company
  await db
    .update(threads)
    .set({
      contact_id: contactId,
      company_id: companyId,
      updated_at_ms: Date.now(),
    })
    .where(eq(threads.id, threadId));

  return contactId;
}

async function handleSpam(threadId: string): Promise<void> {
  const keepUntilMs = Date.now() + SPAM_KEEP_DAYS * 24 * 60 * 60 * 1000;
  await db
    .update(threads)
    .set({
      priority_class: "spam",
      keep_until_ms: keepUntilMs,
      updated_at_ms: Date.now(),
    })
    .where(eq(threads.id, threadId));
}
