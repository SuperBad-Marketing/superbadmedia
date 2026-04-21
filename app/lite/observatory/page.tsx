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
import { PlatformStatusPanel } from "@/components/lite/observatory/platform-status-panel";
import { AnomaliesPanel } from "@/components/lite/observatory/anomalies-panel";
import { TopJobsPanel } from "@/components/lite/observatory/top-jobs-panel";
import { KillSwitchBar } from "@/components/lite/observatory/kill-switch-bar";

export const metadata: Metadata = {
  title: "SuperBad — Observatory",
  robots: { index: false, follow: false },
};

export default async function ObservatoryPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const [mtd, active, resolved, topJobs, killSwitched] = await Promise.all([
    getMtdSummary(),
    getActiveAnomalies(),
    getRecentResolvedAnomalies(),
    getTopJobs(),
    getKillSwitchedJobs(),
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
          style={{ color: "var(--color-neutral-950)" }}
        >
          Cost &amp; Usage
        </h1>
        <p
          className="mt-3 max-w-[640px] font-[family-name:var(--font-serif)] text-[16px] italic leading-relaxed"
          style={{ color: "var(--color-neutral-600)" }}
        >
          Platform spend. Anomalies. Tier health. Everything that costs real money.
        </p>
      </header>

      <div className="flex flex-col gap-6 px-4 pb-8">
        <KillSwitchBar jobs={killSwitched} />
        <PlatformStatusPanel mtd={mtd} />
        <AnomaliesPanel active={active} resolved={resolved} />
        <TopJobsPanel jobs={topJobs} />
      </div>
    </div>
  );
}
