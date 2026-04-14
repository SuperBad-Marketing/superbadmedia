/**
 * /lite/admin/settings/quote-templates — Quote Builder template CRUD.
 * Spec: docs/specs/quote-builder.md §4.5.
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listQuoteTemplates } from "@/lib/quote-builder/templates";
import { listCatalogueItems } from "@/lib/quote-builder/catalogue";
import { TemplatesAdmin } from "./templates-admin";

export const metadata: Metadata = {
  title: "SuperBad — Quote templates",
  robots: { index: false, follow: false },
};

export default async function QuoteTemplatesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const templates = listQuoteTemplates({ includeDeleted: true });
  const catalogue = listCatalogueItems();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Quote templates</h1>
          <p className="text-sm text-muted-foreground">
            Structural scaffolds Andy can reach for when drafting a quote —
            default line items, term length, terms overrides. Client-specific
            prose ("what you told us") is never templated.
          </p>
        </div>
      </header>
      <TemplatesAdmin initialTemplates={templates} catalogue={catalogue} />
    </div>
  );
}
