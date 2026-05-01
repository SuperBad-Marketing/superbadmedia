import { eq, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { brand_dna_answers } from "@/lib/db/schema/brand-dna-answers";
import { brand_dna_profiles } from "@/lib/db/schema/brand-dna-profiles";
import { getQuestionsForTrack } from "@/lib/brand-dna/question-bank";
import type { SectionNumber } from "@/lib/brand-dna/question-bank";
import type { RundownSessionRow } from "@/lib/db/schema/rundown-sessions";

const SECTION_LABELS: Record<number, string> = {
  1: "Aesthetic Identity",
  2: "Communication DNA",
  3: "Values & Instincts",
  4: "Creative Compass",
  5: "Brand Aspiration",
};

function formatTimestamp(ms: number | null): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function formatDuration(startMs: number, endMs: number): string {
  const diffMs = endMs - startMs;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

type SectionStatus = "complete" | "in_progress" | "not_started";

interface SectionProgress {
  section: number;
  label: string;
  status: SectionStatus;
  answered: number;
  total: number;
  completedAt: number | null;
}

interface Props {
  session: RundownSessionRow;
}

export async function AssessmentProgressCard({ session }: Props) {
  if (!session.profile_id) return null;

  const profileRows = await db
    .select({
      current_section: brand_dna_profiles.current_section,
      track: brand_dna_profiles.track,
      status: brand_dna_profiles.status,
    })
    .from(brand_dna_profiles)
    .where(eq(brand_dna_profiles.id, session.profile_id))
    .limit(1);

  const profile = profileRows[0];
  if (!profile) return null;

  const track = (profile.track === "founder" || profile.track === "business")
    ? profile.track
    : "founder";

  const answerCounts = await db
    .select({
      section: brand_dna_answers.section,
      count: count(),
    })
    .from(brand_dna_answers)
    .where(eq(brand_dna_answers.profile_id, session.profile_id))
    .groupBy(brand_dna_answers.section);

  const countMap = new Map(answerCounts.map((r) => [r.section, r.count]));

  const sectionTimestamps: Record<number, number | null> = {
    1: session.section_1_completed_at_ms,
    2: session.section_2_completed_at_ms,
    3: session.section_3_completed_at_ms,
    4: session.section_4_completed_at_ms,
    5: session.section_5_completed_at_ms,
  };

  const sections: SectionProgress[] = ([1, 2, 3, 4, 5] as const).map((n) => {
    const totalQuestions = getQuestionsForTrack(n as SectionNumber, track).length;
    const answered = countMap.get(n) ?? 0;
    const completedAt = sectionTimestamps[n] ?? null;

    let status: SectionStatus = "not_started";
    if (completedAt) {
      status = "complete";
    } else if (answered > 0) {
      status = "in_progress";
    }

    return {
      section: n,
      label: SECTION_LABELS[n],
      status,
      answered,
      total: totalQuestions,
      completedAt,
    };
  });

  const totalAnswered = sections.reduce((sum, s) => sum + s.answered, 0);
  const totalQuestions = sections.reduce((sum, s) => sum + s.total, 0);
  const completedSections = sections.filter((s) => s.status === "complete").length;
  const currentSection = sections.find((s) => s.status === "in_progress");

  const lastActivityMs = Math.max(
    session.completed_at_ms ?? 0,
    session.reveal_reached_at_ms ?? 0,
    session.section_5_completed_at_ms ?? 0,
    session.section_4_completed_at_ms ?? 0,
    session.section_3_completed_at_ms ?? 0,
    session.section_2_completed_at_ms ?? 0,
    session.section_1_completed_at_ms ?? 0,
    session.assessment_started_at_ms ?? 0,
    session.entry_submitted_at_ms,
  );

  const isComplete = session.status === "complete" || session.status === "reveal_reached";
  const reachedReveal = !!session.reveal_reached_at_ms;

  const statusLabel = isComplete
    ? "Completed"
    : reachedReveal
      ? "Reached reveal"
      : currentSection
        ? `Dropped off in Section ${currentSection.section}`
        : session.status === "assessment_started"
          ? "Started, no answers"
          : "Entry only";

  const statusColor = isComplete
    ? "#4ade80"
    : reachedReveal
      ? "#93c5fd"
      : currentSection
        ? "var(--color-brand-orange)"
        : "var(--color-neutral-500)";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Assessment Progress
        </div>
        <span
          className="rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{
            letterSpacing: "1.2px",
            backgroundColor: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: "var(--color-surface-2)",
          boxShadow: "var(--surface-highlight)",
          border: "1px solid rgba(253, 245, 230, 0.03)",
        }}
      >
        {/* Summary line */}
        <div className="flex items-center justify-between mb-5">
          <span
            className="font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-brand-cream)]"
            style={{ opacity: 0.7 }}
          >
            {totalAnswered} of {totalQuestions} questions answered
          </span>
          <span
            className="font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]"
          >
            {session.assessment_started_at_ms
              ? formatDuration(session.assessment_started_at_ms, lastActivityMs)
              : "Not started"}
          </span>
        </div>

        {/* Section progress rows */}
        <div className="flex flex-col gap-2">
          {sections.map((s) => (
            <SectionRow key={s.section} section={s} />
          ))}
        </div>

        {/* Milestone timestamps */}
        {session.assessment_started_at_ms && (
          <div
            className="mt-5 pt-4 flex flex-col gap-1.5"
            style={{ borderTop: "1px solid rgba(253, 245, 230, 0.04)" }}
          >
            <MilestoneRow label="Entry submitted" time={session.entry_submitted_at_ms} />
            <MilestoneRow label="Assessment started" time={session.assessment_started_at_ms} />
            {completedSections > 0 && sections.filter((s) => s.completedAt).map((s) => (
              <MilestoneRow
                key={s.section}
                label={`Section ${s.section} completed`}
                time={s.completedAt}
              />
            ))}
            {reachedReveal && (
              <MilestoneRow label="Reveal reached" time={session.reveal_reached_at_ms} />
            )}
            {session.completed_at_ms && (
              <MilestoneRow label="Completed" time={session.completed_at_ms} />
            )}
            {session.pack_downloaded_at_ms && (
              <MilestoneRow label="Brand Pack downloaded" time={session.pack_downloaded_at_ms} />
            )}
            {session.cta_clicked_at_ms && (
              <MilestoneRow label="Trial shoot CTA clicked" time={session.cta_clicked_at_ms} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionRow({ section }: { section: SectionProgress }) {
  const barPercent = section.total > 0
    ? Math.round((section.answered / section.total) * 100)
    : 0;

  const barColor = section.status === "complete"
    ? "#4ade80"
    : section.status === "in_progress"
      ? "var(--color-brand-orange)"
      : "var(--color-neutral-700)";

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-[140px] shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{
          letterSpacing: "1.2px",
          color: section.status === "not_started"
            ? "var(--color-neutral-600)"
            : "var(--color-neutral-400)",
        }}
      >
        {section.label}
      </span>
      <div
        className="flex-1 h-[5px] rounded-full overflow-hidden"
        style={{ backgroundColor: "rgba(253, 245, 230, 0.04)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${barPercent}%`,
            backgroundColor: barColor,
            opacity: section.status === "not_started" ? 0.3 : 0.7,
          }}
        />
      </div>
      <span
        className="w-[50px] shrink-0 text-right font-[family-name:var(--font-body)] text-[12px]"
        style={{
          color: section.status === "not_started"
            ? "var(--color-neutral-600)"
            : "var(--color-neutral-400)",
        }}
      >
        {section.answered}/{section.total}
      </span>
    </div>
  );
}

function MilestoneRow({ label, time }: { label: string; time: number | null }) {
  if (!time) return null;
  return (
    <div className="flex items-center justify-between">
      <span
        className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
      >
        {label}
      </span>
      <span
        className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]"
        style={{ opacity: 0.6 }}
      >
        {formatTimestamp(time)}
      </span>
    </div>
  );
}
