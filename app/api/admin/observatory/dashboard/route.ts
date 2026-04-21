import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/session";
import {
  getMtdSummary,
  getActiveAnomalies,
  getRecentResolvedAnomalies,
  getTopJobs,
  getKillSwitchedJobs,
} from "@/lib/observatory/queries/dashboard";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [mtd, active, resolved, topJobs, killSwitched] = await Promise.all([
    getMtdSummary(),
    getActiveAnomalies(),
    getRecentResolvedAnomalies(),
    getTopJobs(),
    getKillSwitchedJobs(),
  ]);

  return NextResponse.json({
    mtd,
    anomalies: { active, resolved },
    top_jobs: topJobs,
    kill_switched: killSwitched,
  });
}
