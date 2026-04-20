import { validateApprovalToken } from "@/lib/tasks/approve";
import { ApprovalCard } from "@/components/lite/portal/approval-card";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function ApprovalPage({ params }: Props) {
  const { token } = await params;
  const result = await validateApprovalToken(token);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] px-4">
        <div className="max-w-md text-center">
          <h1 className="mb-4 font-[family-name:var(--font-playfair-display)] text-2xl text-[var(--color-brand-cream)]">
            Link expired or already used
          </h1>
          <p className="font-[family-name:var(--font-dm-sans)] text-sm text-[var(--color-neutral-500)]">
            This approval link is no longer valid. If you need to review this
            deliverable, log in to your portal or ask us to resend.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-base)] px-4">
      <ApprovalCard
        taskId={result.task.id}
        contactId={result.contactId}
        title={result.task.title}
        body={result.task.body}
        checklist={result.task.checklist as Array<{ id: string; text: string; checked: boolean; checked_at: string | null }> | null}
        token={token}
      />
    </div>
  );
}
