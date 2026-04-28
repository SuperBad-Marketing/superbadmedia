import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { newsletterSubscribers } from "@/lib/db/schema/newsletter-subscribers";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { resolveCompanyByDomain } from "@/lib/content-engine/publish";
import { logActivity } from "@/lib/activity-log";

/**
 * Newsletter subscribe endpoint. Accepts two modes:
 *
 * 1. Token-based (external embeds): POST with `token` + `email`
 * 2. Hostname-based (SuperBad's own pages): POST with `email` only,
 *    company resolved from request hostname.
 *
 * Consent source defaults to `embed_form` for token-based,
 * `blog_cta` for hostname-based. Can be overridden via `source` field.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    const fd = await request.formData();
    body = Object.fromEntries(fd.entries()) as Record<string, string>;
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const token = body.token ?? null;
  const source = body.source ?? (token ? "embed_form" : "blog_cta");

  if (!email || !email.includes("@") || !email.includes(".")) {
    return NextResponse.json(
      { error: "Valid email required." },
      { status: 400 },
    );
  }

  const validSources = [
    "embed_form",
    "blog_cta",
    "outreach_reply",
    "permission_pass",
  ] as const;
  const consentSource = validSources.includes(source as (typeof validSources)[number])
    ? (source as (typeof validSources)[number])
    : "embed_form";

  let companyId: string | null = null;

  if (token) {
    const config = await db
      .select({ company_id: contentEngineConfig.company_id })
      .from(contentEngineConfig)
      .where(eq(contentEngineConfig.embed_form_token, token))
      .get();

    companyId = config?.company_id ?? null;
  } else {
    const headerStore = await headers();
    const host =
      headerStore.get("x-forwarded-host") ??
      headerStore.get("host") ??
      "";

    const company = await resolveCompanyByDomain(host);
    if (company) {
      companyId = company.id;
    } else {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const appHost = appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (host.replace(/:\d+$/, "") === appHost.replace(/:\d+$/, "")) {
        const sbCompany = await resolveCompanyByDomain(appHost);
        companyId = sbCompany?.id ?? null;
      }
    }
  }

  if (!companyId) {
    return NextResponse.json(
      { error: "Unable to process subscription." },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: newsletterSubscribers.id, status: newsletterSubscribers.status })
    .from(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.company_id, companyId),
        eq(newsletterSubscribers.email, email),
      ),
    )
    .get();

  if (existing) {
    if (existing.status === "unsubscribed") {
      const nowMs = Date.now();
      await db
        .update(newsletterSubscribers)
        .set({
          status: "active",
          consent_source: consentSource,
          consented_at_ms: nowMs,
          unsubscribed_at_ms: null,
        })
        .where(eq(newsletterSubscribers.id, existing.id));

      return NextResponse.json({ ok: true, resubscribed: true });
    }

    return NextResponse.json({ ok: true, already_subscribed: true });
  }

  const nowMs = Date.now();
  await db.insert(newsletterSubscribers).values({
    id: randomUUID(),
    company_id: companyId,
    email,
    name: (body.name ?? "").trim() || null,
    consent_source: consentSource,
    consented_at_ms: nowMs,
    status: "active",
    bounce_count: 0,
    created_at_ms: nowMs,
  });

  await logActivity({
    companyId,
    kind: "content_subscriber_added",
    body: `New subscriber: ${email} (source: ${consentSource})`,
    meta: { email, source: consentSource },
  });

  return NextResponse.json({ ok: true });
}
