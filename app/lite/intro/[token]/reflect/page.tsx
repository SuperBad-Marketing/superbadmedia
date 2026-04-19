import { redirect } from "next/navigation";
import { loadSubmissionByToken } from "../loaders";
import { loadReflection } from "./loaders";
import { ReflectionClient } from "./reflection-client";

export default async function ReflectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadSubmissionByToken(token);
  if (!data) redirect("/trial-shoot");

  const { submission } = data;

  const validStates = [
    "deliverables_ready",
    "reflection_complete",
  ];
  if (!validStates.includes(submission.funnel_state)) {
    redirect(`/lite/intro/${token}`);
  }

  const existing = await loadReflection(submission.id);

  return (
    <ReflectionClient
      token={token}
      submissionId={submission.id}
      dealId={submission.deal_id}
      submissionName={submission.submitted_name}
      existingReflection={existing}
    />
  );
}
