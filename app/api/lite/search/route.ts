export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { like, or } from "drizzle-orm";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { companies } from "@/lib/db/schema/companies";
import { contacts } from "@/lib/db/schema/contacts";
import { deals } from "@/lib/db/schema/deals";
import { invoices } from "@/lib/db/schema/invoices";
import { quotes } from "@/lib/db/schema/quotes";
import { resolveByAnswer } from "@/lib/riddles/resolve-by-answer";
import type { GlobalSearchResult } from "@/components/lite/global-search";

const MAX_RESULTS_PER_TYPE = 5;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const pattern = `%${q}%`;
  const results: GlobalSearchResult[] = [];

  const [companyRows, contactRows, dealRows, invoiceRows, quoteRows, riddleResult] =
    await Promise.all([
      db
        .select({ id: companies.id, name: companies.name })
        .from(companies)
        .where(like(companies.name_normalised, pattern.toLowerCase()))
        .limit(MAX_RESULTS_PER_TYPE),

      db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
        })
        .from(contacts)
        .where(
          or(
            like(contacts.name, pattern),
            like(contacts.email_normalised, pattern.toLowerCase()),
          ),
        )
        .limit(MAX_RESULTS_PER_TYPE),

      db
        .select({
          id: deals.id,
          title: deals.title,
        })
        .from(deals)
        .where(like(deals.title, pattern))
        .limit(MAX_RESULTS_PER_TYPE),

      db
        .select({
          id: invoices.id,
          invoice_number: invoices.invoice_number,
        })
        .from(invoices)
        .where(like(invoices.invoice_number, pattern))
        .limit(MAX_RESULTS_PER_TYPE),

      db
        .select({
          id: quotes.id,
          quote_number: quotes.quote_number,
          token: quotes.token,
        })
        .from(quotes)
        .where(like(quotes.quote_number, pattern))
        .limit(MAX_RESULTS_PER_TYPE),

      resolveByAnswer(q, {
        actorType: "admin",
        userId: session.user.id,
      }),
    ]);

  if (riddleResult.outcome === "correct" || riddleResult.outcome === "common_wrong") {
    results.push({
      id: q,
      type: "riddle",
      label: riddleResult.outcome === "correct" ? "you found something." : "not quite.",
      sublabel: null,
    });
  }

  for (const r of companyRows) {
    results.push({ id: r.id, type: "company", label: r.name, sublabel: null });
  }
  for (const r of contactRows) {
    results.push({
      id: r.id,
      type: "contact",
      label: r.name,
      sublabel: r.email,
    });
  }
  for (const r of dealRows) {
    results.push({
      id: r.id,
      type: "deal",
      label: r.title,
      sublabel: null,
    });
  }
  for (const r of invoiceRows) {
    results.push({
      id: r.id,
      type: "invoice",
      label: r.invoice_number,
      sublabel: null,
    });
  }
  for (const r of quoteRows) {
    results.push({
      id: r.id,
      type: "quote",
      label: r.quote_number,
      sublabel: null,
    });
  }

  return NextResponse.json({ results });
}
