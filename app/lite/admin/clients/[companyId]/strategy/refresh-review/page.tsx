import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getRefreshReviewData } from "@/lib/six-week-plan/refresh-review-queries";
import { RefreshReviewShell } from "./_components/refresh-review-shell";

interface Props {
  params: Promise<{ companyId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { companyId } = await params;
  const data = await getRefreshReviewData(companyId);
  if (!data) return { title: "Refresh Review" };
  return { title: `Refresh review — ${data.client.companyName}` };
}

export default async function RefreshReviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { companyId } = await params;
  const data = await getRefreshReviewData(companyId);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            Refresh review — {data.client.companyName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.client.contactName} · {data.client.wonOutcome ?? "retainer"} kickoff
          </p>
        </div>
        <a
          href={`/lite/admin/companies/${companyId}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to company
        </a>
      </div>
      <RefreshReviewShell
        activeStrategy={data.activeStrategy}
        client={data.client}
      />
    </div>
  );
}
