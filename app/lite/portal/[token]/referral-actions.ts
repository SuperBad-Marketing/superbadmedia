"use server";

import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal/guard";
import {
  submitReferral,
  dismissMilestonePrompt,
} from "@/lib/referral";

export async function submitReferralAction(data: {
  name: string;
  email: string;
  note: string;
}) {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  await submitReferral({
    referrerContactId: session.contactId,
    referredName: data.name,
    referredEmail: data.email,
    note: data.note || undefined,
  });

  revalidatePath(`/lite/portal`);
}

export async function dismissReferralPromptAction() {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("Not authenticated");
  }

  await dismissMilestonePrompt(session.contactId);
}
