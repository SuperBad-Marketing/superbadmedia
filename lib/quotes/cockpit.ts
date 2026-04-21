import { and, eq, inArray, lte, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { quotes } from "@/lib/db/schema/quotes";
import { companies } from "@/lib/db/schema/companies";
import type { WaitingItem } from "@/lib/tasks/cockpit";

const MS_48H = 48 * 60 * 60 * 1000;

export async function getQuoteWaitingItems(
  nowMs: number = Date.now(),
): Promise<WaitingItem[]> {
  const items: WaitingItem[] = [];

  const draftQuotes = await db
    .select({
      id: quotes.id,
      company_name: companies.name,
      created_at_ms: quotes.created_at_ms,
    })
    .from(quotes)
    .innerJoin(companies, eq(quotes.company_id, companies.id))
    .where(eq(quotes.status, "draft"))
    .all();

  for (const q of draftQuotes) {
    items.push({
      id: `quote_draft_${q.id}`,
      label: `Quote for ${q.company_name} — draft`,
      href: `/lite/quotes/${q.id}`,
      urgency: { kind: "age_of_wait", value: q.created_at_ms },
      scope: "own",
      source: "quote-builder",
    });
  }

  const expiringThreshold = nowMs + MS_48H;
  const expiringQuotes = await db
    .select({
      id: quotes.id,
      company_name: companies.name,
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
    .all();

  for (const q of expiringQuotes) {
    const hoursLeft = Math.max(
      0,
      Math.round((q.expires_at_ms! - nowMs) / (60 * 60 * 1000)),
    );
    const label =
      hoursLeft <= 0
        ? `Quote for ${q.company_name} — expired`
        : hoursLeft < 24
          ? `Quote for ${q.company_name} — expires in ${hoursLeft}h`
          : `Quote for ${q.company_name} — expires in ${Math.round(hoursLeft / 24)}d`;

    items.push({
      id: `quote_expiring_${q.id}`,
      label,
      href: `/lite/quotes/${q.id}`,
      urgency: { kind: "time_sensitive", value: q.expires_at_ms! },
      scope: "own",
      source: "quote-builder",
    });
  }

  return items;
}
