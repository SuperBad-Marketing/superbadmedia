"use server";

import { getPortalSession } from "@/lib/portal/guard";
import { dismissBundleHub } from "@/lib/portal/bundle-hub";
import { logActivity } from "@/lib/activity-log";

export async function dismissHub(
  dismissedTo: "gallery" | "plan",
): Promise<{ ok: boolean }> {
  const session = await getPortalSession();
  if (!session) return { ok: false };

  await dismissBundleHub(session.contactId, dismissedTo);
  return { ok: true };
}

export async function logHubShown(): Promise<void> {
  const session = await getPortalSession();
  if (!session) return;

  await logActivity({
    kind: "bundled_hub_shown",
    contactId: session.contactId,
    body: "",
  });
}
