/**
 * /lite/admin/settings/catalogue — Products / Catalogue CRUD.
 * Spec: docs/specs/quote-builder.md §4.6.
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
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold">Catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Priced deliverables Quote Builder can reach for. Changes don't
            ripple into already-sent quotes — each quote carries its own snapshot.
          </p>
        </div>
      </header>
      <CatalogueAdmin initialItems={items} />
    </div>
  );
}
