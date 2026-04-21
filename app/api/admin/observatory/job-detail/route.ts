export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/session";
import { getJobDetail } from "@/lib/observatory/queries/job-detail";
import { isJobRegistered } from "@/lib/observatory/job-registry";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobKey = searchParams.get("job");
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);

  if (!jobKey) {
    return NextResponse.json({ error: "Missing job parameter" }, { status: 400 });
  }

  if (!isJobRegistered(jobKey)) {
    return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  }

  const detail = await getJobDetail(jobKey, page);
  return NextResponse.json(detail);
}
