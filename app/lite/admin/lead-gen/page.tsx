import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getPendingDrafts, getQueueHeaderData } from "@/lib/lead-gen/queries";
import { killSwitches } from "@/lib/kill-switches";
import { LeadGenTabs } from "./_components/lead-gen-tabs";
import { QueueHeader } from "./_components/queue-header";
import { QueueList } from "./_components/queue-list";
import { LeadGenRunButton } from "./_components/lead-gen-run-button";

export const metadata: Metadata = {
  title: "Lead Gen — SuperBad",
};

export default async function LeadGenQueuePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [drafts, headerData] = await Promise.all([
    getPendingDrafts(),
    getQueueHeaderData(),
  ]);

  const llmEnabled = killSwitches.llm_calls_enabled;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Lead Gen
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Lead Generation
          </h1>
          <LeadGenRunButton />
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Draft queue, run history, the whole pipeline.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {drafts.length > 0
              ? "some are waiting for your eyes."
              : "the machine's ticking over."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {drafts.length}
          </span>
          <span>pending draft{drafts.length === 1 ? "" : "s"}</span>
        </div>
      </header>
      <LeadGenTabs currentPath="/lite/admin/lead-gen" />
      <QueueHeader data={headerData} />
      <QueueList drafts={drafts} llmEnabled={llmEnabled} />
    </div>
  );
}
