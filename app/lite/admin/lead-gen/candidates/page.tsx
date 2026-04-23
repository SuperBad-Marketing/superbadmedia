import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { getAllCandidates } from "@/lib/lead-gen/queries";
import { LeadGenTabs } from "../_components/lead-gen-tabs";

export const metadata: Metadata = {
  title: "Candidates — Lead Gen — SuperBad",
};

function TrackBadge({ track }: { track: string }) {
  const isSaas = track === "saas";
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{
        letterSpacing: "1.2px",
        backgroundColor: isSaas
          ? "rgba(168, 85, 247, 0.15)"
          : "rgba(59, 130, 246, 0.15)",
        color: isSaas ? "#c084fc" : "#93c5fd",
      }}
    >
      {track}
    </span>
  );
}

function StatusBadge({ candidate }: { candidate: Record<string, unknown> }) {
  if (candidate.promoted_to_deal_id) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(34, 197, 94, 0.15)", color: "#86efac" }}
      >
        Promoted
      </span>
    );
  }
  if (candidate.skipped_at) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5" }}
      >
        Skipped
      </span>
    );
  }
  if (candidate.contact_email) {
    return (
      <span
        className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
        style={{ letterSpacing: "1.2px", backgroundColor: "rgba(253, 245, 230, 0.06)", color: "var(--color-neutral-300)" }}
      >
        Active
      </span>
    );
  }
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 font-[family-name:var(--font-label)] text-[9px] uppercase"
      style={{ letterSpacing: "1.2px", backgroundColor: "rgba(253, 245, 230, 0.04)", color: "var(--color-neutral-500)" }}
    >
      No email
    </span>
  );
}

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
        <div className="flex flex-col gap-2 px-4">
          {candidates.map((c) => (
            <Link
              key={c.id}
              href={`/lite/admin/lead-gen/candidates/${c.id}`}
              className="group flex items-center gap-4 rounded-xl p-4 transition-all duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                backgroundColor: "var(--color-surface-2)",
                boxShadow: "var(--surface-highlight)",
                border: "1px solid rgba(253, 245, 230, 0.03)",
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-body)] text-[15px] font-medium text-[color:var(--color-brand-cream)] truncate">
                    {c.company_name}
                  </span>
                  <TrackBadge track={c.qualified_track} />
                  <StatusBadge candidate={c as unknown as Record<string, unknown>} />
                </div>
                <div className="mt-1 flex items-center gap-3 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
                  {c.domain && <span>{c.domain}</span>}
                  {c.contact_email && (
                    <>
                      <span>·</span>
                      <span>{c.contact_email}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{c.sourced_from.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="font-[family-name:var(--font-body)] text-[11px] text-[color:var(--color-neutral-500)]">
                    Score
                  </div>
                  <div className="font-[family-name:var(--font-body)] text-[16px] font-mono text-[color:var(--color-brand-cream)]">
                    {c.qualified_track === "saas" ? c.saas_score : c.retainer_score}
                  </div>
                </div>
                <span
                  className="text-[color:var(--color-neutral-500)] transition-colors group-hover:text-[color:var(--color-brand-pink)]"
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
