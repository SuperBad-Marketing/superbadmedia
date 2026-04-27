import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getLeadGenSettingsAction } from "../actions";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { LeadGenSettingsForm } from "../_components/lead-gen-settings-form";

export const metadata: Metadata = {
  title: "Lead Gen Settings — SuperBad",
};

export default async function LeadGenSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const settings = await getLeadGenSettingsAction();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Lead Gen · Settings
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Search Settings
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Where to look and how many to find.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            cast wide, refine later.
          </em>
        </p>
      </header>
      <LeadGenTabs currentPath="/lite/admin/lead-gen/settings" />
      <LeadGenSettingsForm initial={settings} />
    </div>
  );
}
