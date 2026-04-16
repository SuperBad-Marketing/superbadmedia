/**
 * /lite/admin/settings/catalogue — Products / Catalogue CRUD.
 * Spec: docs/specs/quote-builder.md §4.6.
 * Visual rebuild: sessions/admin-polish-6-brief.md against mockup-admin-interior.html.
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { listCatalogueItems } from "@/lib/quote-builder/catalogue";
import { CatalogueAdmin } from "./catalogue-admin";

export const metadata: Metadata = {
  title: "SuperBad — Catalogue",
  robots: { index: false, follow: false },
};

export default async function CatalogueSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const items = listCatalogueItems({ includeDeleted: true });
  const activeCount = items.filter((it) => it.deleted_at_ms == null).length;

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
            Catalogue
          </span>
        </div>
        <div className="mt-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            Catalogue
          </h1>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Priced deliverables Quote Builder can reach for.
          {activeCount > 0 ? (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {activeCount} thing{activeCount === 1 ? "" : "s"} to charge for.
              </em>
            </>
          ) : null}
        </p>
      </header>
      <CatalogueAdmin initialItems={items} />
    </div>
  );
}
