import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import {
  getMtdSummary,
  getActiveAnomalies,
  getRecentResolvedAnomalies,
  getTopJobs,
  getKillSwitchedJobs,
} from "@/lib/observatory/queries/dashboard";
import { getTierHealth } from "@/lib/observatory/queries/tier-health";
import { PlatformStatusPanel } from "@/components/lite/observatory/platform-status-panel";
import { AnomaliesPanel } from "@/components/lite/observatory/anomalies-panel";
import { TopJobsPanel } from "@/components/lite/observatory/top-jobs-panel";
import { KillSwitchBar } from "@/components/lite/observatory/kill-switch-bar";
import { TierHealthPanel } from "@/components/lite/observatory/tier-health-panel";

export const metadata: Metadata = {
  title: "SuperBad | Observatory",
  robots: { index: false, follow: false },
};

export default async function ObservatoryPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const [mtd, active, resolved, topJobs, killSwitched, tierHealth] = await Promise.all([
    getMtdSummary(),
    getActiveAnomalies(),
    getRecentResolvedAnomalies(),
    getTopJobs(),
    getKillSwitchedJobs(),
    getTierHealth(),
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
          Cost &amp; Usage
        </h1>
        <p
          className="mt-3 max-w-[640px] font-[family-name:var(--font-serif)] text-[16px] italic leading-relaxed"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Platform spend. Anomalies. Tier health. Everything that costs real money.
        </p>
        <nav className="mt-3">
          <a
            href="/lite/observatory/settings"
            className="text-[13px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Settings
          </a>
        </nav>
      </header>

      <div className="flex flex-col gap-6 px-4 pb-8">
        <KillSwitchBar jobs={killSwitched} />
        <PlatformStatusPanel mtd={mtd} />
        <TierHealthPanel tiers={tierHealth} />
        <AnomaliesPanel active={active} resolved={resolved} />
        <TopJobsPanel jobs={topJobs} />
      </div>
    </div>
  );
}
