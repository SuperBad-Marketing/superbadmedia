"use server";

import { auth } from "@/lib/auth/session";
import { runGraphSyncCycle } from "@/lib/scheduled-tasks/handlers/inbox-graph-sync";

export async function triggerInboxSync(): Promise<{
  inserted: number;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { inserted: 0, error: "Unauthorized" };
  }

  try {
    const result = await runGraphSyncCycle();
    return { inserted: result.inserted };
  } catch (err) {
    console.error("[inbox-sync] Manual sync failed:", err);
    return { inserted: 0, error: "Sync failed" };
  }
}
