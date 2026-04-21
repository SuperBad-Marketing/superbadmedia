import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth/session";
import { getAnomalyDetail } from "@/lib/observatory/queries/anomaly-detail";
import { getJobEntry } from "@/lib/observatory/job-registry";
import { DiagnosisCard } from "@/components/lite/observatory/diagnosis-card";
import { RawDataTable } from "@/components/lite/observatory/raw-data-table";
import { AnomalyActions } from "@/components/lite/observatory/anomaly-actions";

export const metadata: Metadata = {
  title: "SuperBad — Anomaly Detail",
  robots: { index: false, follow: false },
};

export default async function AnomalyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const { id } = await params;
  const detail = await getAnomalyDetail(id);
  if (!detail) notFound();

  const { anomaly, recent_calls } = detail;
  const jobEntry = getJobEntry(anomaly.job);

  return (
    <div className="min-h-full">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          <Link
            href="/lite/observatory"
            className="underline-offset-2 hover:underline"
          >
            Observatory
          </Link>
          {" · "}
          Anomaly
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none"
          style={{ color: "var(--color-neutral-950)" }}
        >
          {anomaly.job}
        </h1>
        <p
          className="mt-3 max-w-[640px] font-[family-name:var(--font-serif)] text-[16px] italic leading-relaxed"
          style={{ color: "var(--color-neutral-600)" }}
        >
          {anomaly.detector.replace("_", " ")} · {anomaly.tier} tier ·{" "}
          {anomaly.fire_count} fires
        </p>
      </header>

      <div className="flex flex-col gap-6 px-4 pb-8">
        <DiagnosisCard diagnosis={anomaly.diagnosis_json} />

        <AnomalyActions
          anomalyId={anomaly.id}
          job={anomaly.job}
          tier={anomaly.tier}
          isKillSwitched={anomaly.kill_switch_triggered_at_ms != null}
          isAcknowledged={anomaly.acknowledged_at_ms != null}
          currentBands={jobEntry?.bands ?? null}
        />

        <RawDataTable calls={recent_calls} />
      </div>
    </div>
  );
}
