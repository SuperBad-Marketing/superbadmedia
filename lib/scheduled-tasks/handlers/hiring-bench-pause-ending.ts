import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema/candidates";
import { role_briefs } from "@/lib/db/schema/role-briefs";
import { logActivity } from "@/lib/activity-log";
import { sendEmail } from "@/lib/channels/email/send";

const handleBenchPauseEnding: TaskHandler = async (task) => {
  const payload = task.payload as { candidate_id?: string } | null;
  const candidateId = payload?.candidate_id;
  if (!candidateId) return;

  const candidate = await db.query.candidates.findFirst({
    where: eq(candidates.id, candidateId),
  });
  if (!candidate) return;
  if (candidate.stage !== "bench") return;
  if (candidate.bench_status !== "paused") return;
  if (!candidate.paused_until_ms) return;

  const nowMs = Date.now();
  if (candidate.paused_until_ms <= nowMs) return;

  const roleBrief = candidate.role_brief_id
    ? await db.query.role_briefs.findFirst({
        where: eq(role_briefs.id, candidate.role_brief_id),
      })
    : null;

  const resumeDate = new Date(candidate.paused_until_ms);
  const formattedDate = resumeDate.toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const roleName = roleBrief?.role_name ?? "Unknown role";

  await sendEmail({
    to: "andy@superbadmedia.com.au",
    subject: `Bench pause ending: ${candidate.name} resumes ${formattedDate}`,
    body: [
      `${candidate.name} (${roleName}) is set to resume on ${formattedDate}.`,
      "",
      "If you need to extend the pause, update their availability in the hiring pipeline.",
    ].join("\n"),
    classification: "transactional",
    purpose: "bench_pause_ending_reminder",
  });

  await logActivity({
    kind: "bench_pause_ending_notified",
    body: `Pause ending notification sent for ${candidate.name} — resumes ${formattedDate}.`,
    meta: {
      candidate_id: candidateId,
      role_brief_id: candidate.role_brief_id,
      paused_until_ms: candidate.paused_until_ms,
    },
  });
};

export const HIRING_BENCH_PAUSE_ENDING_HANDLERS: HandlerMap = {
  hiring_bench_pause_ending: handleBenchPauseEnding,
};
