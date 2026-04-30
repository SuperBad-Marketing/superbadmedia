import { and, eq, lte, gte, isNotNull, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { threads } from "@/lib/db/schema/messages";
import { contacts } from "@/lib/db/schema/contacts";
import { instagram_replies } from "@/lib/db/schema/instagram";
import { outreachDrafts } from "@/lib/db/schema/outreach-drafts";
import { leadCandidates } from "@/lib/db/schema/lead-candidates";
import { blogPosts } from "@/lib/db/schema/blog-posts";
import { companies } from "@/lib/db/schema/companies";
import { quotes } from "@/lib/db/schema/quotes";

export type NeedsYouItemType =
  | "outreach_draft"
  | "instagram_reply"
  | "content_draft"
  | "unreplied_email"
  | "support_ticket"
  | "draft_quote"
  | "expiring_quote";

export interface NeedsYouItem {
  id: string;
  type: NeedsYouItemType;
  label: string;
  sublabel?: string;
  timestamp: number;
  meta: Record<string, unknown>;
}

const MS_24H = 86400000;
const MS_48H = MS_24H * 2;
const MS_7D = MS_24H * 7;

export async function getNeedsYouItems(
  nowMs: number = Date.now(),
): Promise<NeedsYouItem[]> {
  const results = await Promise.allSettled([
    getOutreachDrafts(),
    getInstagramReplies(),
    getContentDrafts(nowMs),
    getUnrepliedEmails(nowMs),
    getSupportTickets(nowMs),
    getDraftQuotes(),
    getExpiringQuotes(nowMs),
  ]);

  const items: NeedsYouItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") items.push(...r.value);
  }

  items.sort((a, b) => a.timestamp - b.timestamp);
  return items;
}

async function getOutreachDrafts(): Promise<NeedsYouItem[]> {
  const drafts = await db
    .select({
      id: outreachDrafts.id,
      subject: outreachDrafts.subject,
      body_markdown: outreachDrafts.body_markdown,
      touch_kind: outreachDrafts.touch_kind,
      created_at: outreachDrafts.created_at,
      company_name: leadCandidates.company_name,
      contact_name: leadCandidates.contact_name,
      contact_email: leadCandidates.contact_email,
    })
    .from(outreachDrafts)
    .leftJoin(leadCandidates, eq(outreachDrafts.candidate_id, leadCandidates.id))
    .where(eq(outreachDrafts.status, "pending_approval"))
    .orderBy(outreachDrafts.created_at)
    .limit(10);

  return drafts.map((d) => ({
    id: `outreach_${d.id}`,
    type: "outreach_draft" as const,
    label: d.company_name ?? d.contact_name ?? "Unknown prospect",
    sublabel: d.subject,
    timestamp: d.created_at?.getTime() ?? Date.now(),
    meta: {
      draftId: d.id,
      companyName: d.company_name,
      contactName: d.contact_name,
      contactEmail: d.contact_email,
      subject: d.subject,
      bodyMarkdown: d.body_markdown,
      touchKind: d.touch_kind,
    },
  }));
}

async function getInstagramReplies(): Promise<NeedsYouItem[]> {
  const pending = await db
    .select({
      id: instagram_replies.id,
      inbound_author: instagram_replies.inbound_author,
      inbound_text: instagram_replies.inbound_text,
      draft_text: instagram_replies.draft_text,
      reply_type: instagram_replies.reply_type,
      created_at_ms: instagram_replies.created_at_ms,
    })
    .from(instagram_replies)
    .where(eq(instagram_replies.status, "pending_review"))
    .orderBy(instagram_replies.created_at_ms)
    .limit(10);

  return pending.map((r) => ({
    id: `ig_${r.id}`,
    type: "instagram_reply" as const,
    label: `@${r.inbound_author ?? "unknown"}`,
    sublabel: r.inbound_text
      ? r.inbound_text.length > 80
        ? r.inbound_text.slice(0, 80) + "…"
        : r.inbound_text
      : `${r.reply_type} reply`,
    timestamp: r.created_at_ms,
    meta: {
      replyId: r.id,
      inboundAuthor: r.inbound_author,
      inboundText: r.inbound_text,
      draftText: r.draft_text,
      replyType: r.reply_type,
    },
  }));
}

async function getContentDrafts(nowMs: number): Promise<NeedsYouItem[]> {
  const posts = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      body: blogPosts.body,
      company_id: blogPosts.company_id,
      company_name: companies.name,
      updated_at_ms: blogPosts.updated_at_ms,
    })
    .from(blogPosts)
    .leftJoin(companies, eq(blogPosts.company_id, companies.id))
    .where(eq(blogPosts.status, "in_review"))
    .orderBy(blogPosts.updated_at_ms)
    .limit(10);

  return posts.map((p) => ({
    id: `content_${p.id}`,
    type: "content_draft" as const,
    label: p.title ?? "Untitled draft",
    sublabel: p.company_name ? `For ${p.company_name}` : "Own content",
    timestamp: p.updated_at_ms,
    meta: {
      postId: p.id,
      title: p.title,
      bodyPreview: p.body
        ? p.body.length > 200
          ? p.body.slice(0, 200) + "…"
          : p.body
        : null,
      companyName: p.company_name,
      isFleet: !!p.company_id,
    },
  }));
}

async function getUnrepliedEmails(nowMs: number): Promise<NeedsYouItem[]> {
  const rows = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      contact_name: contacts.name,
      contact_email: contacts.email,
      last_inbound_at_ms: threads.last_inbound_at_ms,
    })
    .from(threads)
    .leftJoin(contacts, eq(threads.contact_id, contacts.id))
    .where(
      and(
        eq(threads.priority_class, "signal"),
        isNotNull(threads.last_inbound_at_ms),
        sql`(${threads.last_outbound_at_ms} IS NULL OR ${threads.last_inbound_at_ms} > ${threads.last_outbound_at_ms})`,
        lte(threads.last_inbound_at_ms, nowMs - MS_24H),
        gte(threads.last_inbound_at_ms, nowMs - MS_7D),
      ),
    )
    .limit(10);

  return rows.map((t) => ({
    id: `email_${t.id}`,
    type: "unreplied_email" as const,
    label: t.contact_name ?? t.contact_email ?? "Unknown",
    sublabel: t.subject ?? "No subject",
    timestamp: t.last_inbound_at_ms!,
    meta: {
      threadId: t.id,
      contactName: t.contact_name,
      contactEmail: t.contact_email,
      subject: t.subject,
    },
  }));
}

async function getSupportTickets(nowMs: number): Promise<NeedsYouItem[]> {
  const rows = await db
    .select({
      id: threads.id,
      subject: threads.subject,
      contact_name: contacts.name,
      created_at_ms: threads.created_at_ms,
    })
    .from(threads)
    .leftJoin(contacts, eq(threads.contact_id, contacts.id))
    .where(
      and(
        eq(threads.ticket_status, "open"),
        lte(threads.created_at_ms, nowMs - MS_48H),
        gte(threads.created_at_ms, nowMs - MS_7D),
      ),
    )
    .limit(10);

  const unrepliedIds = new Set(
    (await getUnrepliedEmails(nowMs)).map((e) => e.meta.threadId as string),
  );

  return rows
    .filter((t) => !unrepliedIds.has(t.id))
    .map((t) => ({
      id: `ticket_${t.id}`,
      type: "support_ticket" as const,
      label: t.contact_name ?? "Support ticket",
      sublabel: t.subject ?? "Open ticket",
      timestamp: t.created_at_ms,
      meta: {
        threadId: t.id,
        contactName: t.contact_name,
        subject: t.subject,
      },
    }));
}

async function getDraftQuotes(): Promise<NeedsYouItem[]> {
  const rows = await db
    .select({
      id: quotes.id,
      company_name: companies.name,
      total_cents: quotes.total_cents_inc_gst,
      created_at_ms: quotes.created_at_ms,
    })
    .from(quotes)
    .innerJoin(companies, eq(quotes.company_id, companies.id))
    .where(eq(quotes.status, "draft"))
    .limit(10);

  return rows.map((q) => ({
    id: `quote_${q.id}`,
    type: "draft_quote" as const,
    label: q.company_name ?? "Unknown company",
    sublabel: q.total_cents
      ? `$${(q.total_cents / 100).toLocaleString("en-AU")} quote`
      : "Quote — draft",
    timestamp: q.created_at_ms,
    meta: {
      quoteId: q.id,
      companyName: q.company_name,
      totalCents: q.total_cents,
    },
  }));
}

async function getExpiringQuotes(nowMs: number): Promise<NeedsYouItem[]> {
  const expiringThreshold = nowMs + MS_48H;

  const rows = await db
    .select({
      id: quotes.id,
      company_name: companies.name,
      total_cents: quotes.total_cents_inc_gst,
      expires_at_ms: quotes.expires_at_ms,
    })
    .from(quotes)
    .innerJoin(companies, eq(quotes.company_id, companies.id))
    .where(
      and(
        inArray(quotes.status, ["sent", "viewed"]),
        isNotNull(quotes.expires_at_ms),
        lte(quotes.expires_at_ms, expiringThreshold),
      ),
    )
    .limit(10);

  return rows.map((q) => {
    const hoursLeft = Math.max(
      0,
      Math.round((q.expires_at_ms! - nowMs) / 3600000),
    );
    const timeLabel =
      hoursLeft <= 0
        ? "expired"
        : hoursLeft < 24
          ? `expires in ${hoursLeft}h`
          : `expires in ${Math.round(hoursLeft / 24)}d`;

    return {
      id: `quote_exp_${q.id}`,
      type: "expiring_quote" as const,
      label: q.company_name ?? "Unknown company",
      sublabel: `Quote ${timeLabel}`,
      timestamp: q.expires_at_ms!,
      meta: {
        quoteId: q.id,
        companyName: q.company_name,
        totalCents: q.total_cents,
        expiresAtMs: q.expires_at_ms,
        hoursLeft,
      },
    };
  });
}
