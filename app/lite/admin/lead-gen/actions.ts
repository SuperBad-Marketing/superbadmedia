"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/session";
import { runLeadGenDaily } from "@/lib/lead-gen";

export async function triggerManualRun(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  try {
    await runLeadGenDaily("run_now");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: message };
  }
}
