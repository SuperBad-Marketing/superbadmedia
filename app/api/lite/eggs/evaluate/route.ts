export const dynamic = "force-dynamic";

/**
 * POST /api/lite/eggs/evaluate
 *
 * Called on admin session/cockpit load. Evaluates admin egg triggers,
 * returns the fired egg (if any) for the client to render.
 *
 * Auth: admin only.
 * Owner: SD-7. Spec: docs/specs/surprise-and-delight.md §Trigger evaluator.
 */
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/session";
import { orchestrateAdminEggs } from "@/lib/eggs/orchestrate-admin";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await orchestrateAdminEggs(session.user.id);

  return NextResponse.json(result);
}
