import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import {
  getObservatorySettings,
  getJobBandList,
} from "@/lib/observatory/queries/settings";
import { ObservatorySettingsForm } from "@/components/lite/observatory/observatory-settings-form";

export const metadata: Metadata = {
  title: "SuperBad — Observatory Settings",
  robots: { index: false, follow: false },
};

export default async function ObservatorySettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const [settings, jobs] = await Promise.all([
    getObservatorySettings(),
    getJobBandList(),
  ]);

  return (
    <div className="min-h-full">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Admin · Observatory
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none"
          style={{ color: "var(--color-neutral-100)" }}
        >
          Settings
        </h1>
        <p
          className="mt-3 max-w-[640px] font-[family-name:var(--font-serif)] text-[16px] italic leading-relaxed"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Thresholds, toggles, and the full job registry.
        </p>
        <nav className="mt-3">
          <a
            href="/lite/observatory"
            className="text-[13px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Back to Observatory
          </a>
        </nav>
      </header>

      <div className="px-4 pb-8">
        <ObservatorySettingsForm initialSettings={settings} jobs={jobs} />
      </div>
    </div>
  );
}
