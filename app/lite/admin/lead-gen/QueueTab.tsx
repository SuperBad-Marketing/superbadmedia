import type { QueueDraft, QueueHeaderData } from "@/lib/lead-gen/queries";
import { QueueHeader } from "./_components/queue-header";
import { QueueList } from "./_components/queue-list";

interface QueueTabProps {
  drafts: QueueDraft[];
  headerData: QueueHeaderData;
  llmEnabled: boolean;
}

export function QueueTab({ drafts, headerData, llmEnabled }: QueueTabProps) {
  return (
    <>
      <QueueHeader data={headerData} />
      <QueueList drafts={drafts} llmEnabled={llmEnabled} />
    </>
  );
}
