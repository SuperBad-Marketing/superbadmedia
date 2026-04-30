import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import {
  getFunnelMetrics,
  getApprovalRateSparkline,
  getWarmupProgress,
  getAutonomyStates,
} from "@/lib/lead-gen/queries";
import { getRundownSequenceMetrics } from "@/lib/rundown/sequence-queries";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { MetricsPanel } from "../_components/metrics-panel";
import { RundownMetricsCard } from "../_components/rundown-metrics-card";

export const metadata: Metadata = {
  title: "Lead Gen Metrics — SuperBad",
};

export default async function LeadGenMetricsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [funnel, saasSparkline, retainerSparkline, warmup, autonomyStates, rundownMetrics] = await Promise.all([
    getFunnelMetrics(),
    getApprovalRateSparkline("saas"),
    getApprovalRateSparkline("retainer"),
    getWarmupProgress(),
    getAutonomyStates(),
    getRundownSequenceMetrics(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <LeadGenTabs currentPath="/lite/admin/lead-gen/metrics" />
      <MetricsPanel
        funnel={funnel}
        saasSparkline={saasSparkline}
        retainerSparkline={retainerSparkline}
        warmup={warmup}
        autonomyStates={autonomyStates}
      />
      <div className="mt-6 px-4">
        <RundownMetricsCard metrics={rundownMetrics} />
      </div>
    </div>
  );
}
