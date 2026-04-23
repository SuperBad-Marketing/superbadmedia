import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getAllCandidates } from "@/lib/lead-gen/queries";
import { LeadGenTabs } from "../_components/lead-gen-tabs";
import { CandidatesList } from "./_components/candidates-list";

export const metadata: Metadata = {
  title: "Candidates — Lead Gen — SuperBad",
};

export default async function CandidatesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const candidates = await getAllCandidates();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Lead Gen · Candidates
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Candidates
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Every prospect the pipeline has found.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            click one to see the full picture.
          </em>
        </p>
      </header>
      <LeadGenTabs currentPath="/lite/admin/lead-gen/candidates" />

      {candidates.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-[28px] text-[color:var(--color-brand-cream)]">
            No candidates yet.
          </p>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            Run a search from the Queue tab to discover prospects.
          </p>
        </div>
      ) : (
        <div className="px-4">
          <CandidatesList candidates={candidates as Parameters<typeof CandidatesList>[0]["candidates"]} />
        </div>
      )}
    </div>
  );
}
