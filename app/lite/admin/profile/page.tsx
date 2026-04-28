/**
 * /lite/admin/profile — SuperBad business profile admin page.
 * Spec: docs/specs/superbad-profile.md §9.
 * Admin-only; non-admins redirect to sign-in.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { loadProfileSections, loadPendingSuggestions, loadDraftBrandDna } from "./actions";
import { ProfileDashboard } from "./profile-dashboard";

export const metadata: Metadata = {
  title: "SuperBad — Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [{ sections, brandDna }, suggestions, draftBrandDna] = await Promise.all([
    loadProfileSections(),
    loadPendingSuggestions(),
    loadDraftBrandDna(),
  ]);

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Profile
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Profile
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          The source of truth for who SuperBad is.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            Every AI feature reads from this.
          </em>
        </p>
      </header>
      <ProfileDashboard
        initialSections={sections}
        brandDna={brandDna}
        draftBrandDna={draftBrandDna}
        initialSuggestions={suggestions}
      />
    </div>
  );
}
