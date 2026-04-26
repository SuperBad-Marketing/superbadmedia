"use server";

import { auth } from "@/lib/auth/session";
import { generateBriefForSlot } from "@/lib/cockpit/generate-brief";
import { getCurrentSlot } from "@/lib/cockpit/queries";
import { revalidatePath } from "next/cache";

export async function regenerateBriefAction() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false as const, error: "Unauthorized" };
  }

  const slot = getCurrentSlot();
  const result = await generateBriefForSlot(slot, {
    trigger: "material_event",
    triggerEvent: "manual_refresh",
  });

  revalidatePath("/lite/cockpit");

  if (!result.generated) {
    return { ok: true as const, quiet: true };
  }

  return { ok: true as const, quiet: false, prose: result.prose };
}
