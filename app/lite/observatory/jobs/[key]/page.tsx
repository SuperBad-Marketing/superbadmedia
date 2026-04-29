import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { getJobDetail } from "@/lib/observatory/queries/job-detail";
import { isJobRegistered } from "@/lib/observatory/job-registry";
import { JobDetailView } from "@/components/lite/observatory/job-detail-view";

export const metadata: Metadata = {
  title: "SuperBad | Job Detail",
  robots: { index: false, follow: false },
};

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const { key } = await params;
  const jobKey = decodeURIComponent(key);

  if (!isJobRegistered(jobKey)) {
    notFound();
  }

  const detail = await getJobDetail(jobKey);

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
          {jobKey}
        </h1>
        <nav className="mt-3 flex gap-4">
          <a
            href="/lite/observatory"
            className="text-[13px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Observatory
          </a>
          <a
            href="/lite/observatory/settings"
            className="text-[13px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Settings
          </a>
        </nav>
      </header>

      <div className="px-4 pb-8">
        <JobDetailView detail={detail} />
      </div>
    </div>
  );
}
