import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getPendingDrafts, getQueueHeaderData } from "@/lib/lead-gen/queries";
import { killSwitches } from "@/lib/kill-switches";
import { LeadGenTabs } from "./_components/lead-gen-tabs";
import { QueueHeader } from "./_components/queue-header";
import { QueueList } from "./_components/queue-list";

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
      <LeadGenTabs currentPath="/lite/admin/lead-gen" />
      <QueueHeader data={headerData} />
      <QueueList drafts={drafts} llmEnabled={llmEnabled} />
    </div>
  );
}
