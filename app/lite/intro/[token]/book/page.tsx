import { redirect } from "next/navigation";
import { loadSubmissionByToken } from "../loaders";
import { BookingClient } from "./booking-client";

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadSubmissionByToken(token);
  if (!data) redirect("/trial-shoot");

  const { submission } = data;
  if (submission.funnel_state !== "paid") {
    redirect(`/lite/intro/${token}`);
  }

  return <BookingClient token={token} submissionName={submission.submitted_name} />;
}
