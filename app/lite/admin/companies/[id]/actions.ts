"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/session";
import {
  advanceTrialShootStatus,
  updateTrialShootPlan,
  type TrialShootStatus,
} from "@/lib/crm";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export async function advanceTrialShootStatusAction(
  companyId: string,
  toStatus: TrialShootStatus,
): Promise<ActionResult<{ status: TrialShootStatus }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    const { company } = advanceTrialShootStatus(companyId, toStatus, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true, value: { status: company.trial_shoot_status } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Advance failed.",
    };
  }
}

export async function updateTrialShootPlanAction(
  companyId: string,
  plan: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, error: "Not authorised." };
  }
  try {
    updateTrialShootPlan(companyId, plan, {
      by: `user:${session.user.id ?? "admin"}`,
    });
    revalidatePath(`/lite/admin/companies/${companyId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Save failed.",
    };
  }
}
