import { redirect } from "next/navigation";
import { loadSubmissionByToken } from "../loaders";
import { loadBookingForSubmission } from "./loaders";
import { ManageBookingClient } from "./manage-booking-client";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await loadSubmissionByToken(token);
  if (!data) redirect("/trial-shoot");

  const { submission } = data;
  const booking = await loadBookingForSubmission(submission.id);

  if (!booking || booking.status !== "booked") {
    redirect(`/lite/intro/${token}`);
  }

  return (
    <ManageBookingClient
      token={token}
      submissionName={submission.submitted_name}
      booking={{
        id: booking.id,
        slotStartMs: booking.slot_start_at_ms,
        slotEndMs: booking.slot_end_at_ms,
        rescheduleCount: booking.reschedule_count,
      }}
    />
  );
}
