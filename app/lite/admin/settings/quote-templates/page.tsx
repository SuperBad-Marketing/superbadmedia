/**
 * /lite/admin/settings/quote-templates — Quote Builder template CRUD.
 * Spec: docs/specs/quote-builder.md §4.5.
 * Visual rebuild: sessions/admin-polish-6-brief.md against mockup-admin-interior.html.
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
  const activeCount = templates.filter(
    (t) => t.deleted_at_ms == null,
  ).length;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          Settings{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Quote templates
          </span>
        </div>
        <div className="mt-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            Quote templates
          </h1>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Structural scaffolds for drafting quotes.
          {activeCount > 0 ? (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {activeCount} shortcut{activeCount === 1 ? "" : "s"} to a quote.
              </em>
            </>
          ) : null}
        </p>
      </header>
      <TemplatesAdmin initialTemplates={templates} catalogue={catalogue} />
    </div>
  );
}
