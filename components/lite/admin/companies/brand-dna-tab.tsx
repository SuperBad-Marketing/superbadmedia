import Link from "next/link";
import type { BrandDnaProfileRow } from "@/lib/db/schema/brand-dna-profiles";
import type { BrandDnaBlendRow } from "@/lib/db/schema/brand-dna-blends";
import type { ContactRow } from "@/lib/db/schema/contacts";

type CompanyShape = "solo_founder" | "founder_led_team" | "multi_stakeholder_company" | null;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  complete: {
    label: "Complete",
    color: "var(--color-success)",
    bg: "rgba(123, 174, 126, 0.14)",
  },
  in_progress: {
    label: "In progress",
    color: "var(--color-brand-orange)",
    bg: "rgba(242, 140, 82, 0.14)",
  },
  pending: {
    label: "Not started",
    color: "var(--color-neutral-500)",
    bg: "rgba(128, 127, 115, 0.15)",
  },
};

function ProfileStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{ letterSpacing: "1.5px", background: style.bg, color: style.color }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {style.label}
    </span>
  );
}

// signal_tags: either Record<string, number> (full assessment) or string[] (dry-run)
function parseSignalTags(json: string | null): { tag: string; freq: number }[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s): s is string => typeof s === "string")
        .map((t) => ({ tag: t, freq: 1 }));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, number>)
        .map(([tag, freq]) => ({ tag, freq: freq as number }))
        .sort((a, b) => b.freq - a.freq);
    }
  } catch {}
  return [];
}

// section_scores: Record<string, number> (e.g. { voice: 85, visual: 78 })
function parseSectionScores(json: string | null): { section: string; score: number }[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Record<string, number>;
    return Object.entries(parsed)
      .map(([section, score]) => ({ section, score }))
      .sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

// section_insights: Record<string, string> or string[]
function parseSectionInsights(json: string | null): { label: string; text: string }[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s): s is string => typeof s === "string" && s.length > 0)
        .map((text, i) => ({ label: `Section ${i + 1}`, text }));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed as Record<string, string>)
        .filter(([, v]) => typeof v === "string" && v.length > 0)
        .map(([key, text]) => ({ label: key.charAt(0).toUpperCase() + key.slice(1), text }));
    }
  } catch {}
  return [];
}

interface ParsedInsight {
  headline: string;
  followThrough: string;
  evidence: string;
}

function parseKeyInsights(prosePortrait: string | null): ParsedInsight[] {
  if (!prosePortrait) return [];
  const insightsIdx = prosePortrait.indexOf("[KEY_INSIGHTS]");
  if (insightsIdx === -1) return [];

  const insightsText = prosePortrait.slice(insightsIdx + "[KEY_INSIGHTS]".length);
  const blocks = insightsText.split("---").filter((b) => b.trim().length > 0);

  return blocks.map((block) => {
    const headlineMatch = block.match(/HEADLINE:\s*(.+?)(?:\n|$)/);
    const followMatch = block.match(/FOLLOW_THROUGH:\s*([\s\S]+?)(?:\nEVIDENCE:|$)/);
    const evidenceMatch = block.match(/EVIDENCE:\s*([\s\S]+?)$/);
    return {
      headline: headlineMatch?.[1]?.trim() ?? "",
      followThrough: followMatch?.[1]?.trim() ?? "",
      evidence: evidenceMatch?.[1]?.trim() ?? "",
    };
  }).filter((i) => i.headline.length > 0);
}

function extractPortraitText(prosePortrait: string | null): string | null {
  if (!prosePortrait) return null;

  const portraitIdx = prosePortrait.indexOf("[PORTRAIT]");
  const insightsIdx = prosePortrait.indexOf("[KEY_INSIGHTS]");

  if (portraitIdx !== -1 && insightsIdx !== -1) {
    return prosePortrait.slice(portraitIdx + "[PORTRAIT]".length, insightsIdx).trim();
  }
  if (portraitIdx !== -1) {
    return prosePortrait.slice(portraitIdx + "[PORTRAIT]".length).trim();
  }
  if (insightsIdx !== -1) {
    return prosePortrait.slice(0, insightsIdx).trim();
  }
  return prosePortrait.trim();
}

const SCORE_COLORS: Record<string, string> = {
  voice: "244, 160, 176",
  visual: "178, 40, 72",
  strategy: "242, 140, 82",
  positioning: "210, 70, 68",
  values: "192, 50, 72",
  creative: "230, 90, 76",
  aspiration: "244, 160, 176",
  communication: "178, 40, 72",
  aesthetic: "242, 140, 82",
};

function buildScoreSummary(
  sectionScores: { section: string; score: number }[],
  signalTags: { tag: string; freq: number }[],
): string | null {
  if (sectionScores.length === 0 && signalTags.length === 0) return null;

  const parts: string[] = [];

  if (sectionScores.length > 0) {
    const sorted = [...sectionScores].sort((a, b) => b.score - a.score);
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const avg = Math.round(sorted.reduce((s, x) => s + x.score, 0) / sorted.length);

    parts.push(
      `${strongest.section.charAt(0).toUpperCase() + strongest.section.slice(1)} is the strongest dimension at ${strongest.score}/100.`,
    );

    if (sorted.length > 1 && strongest.score - weakest.score > 10) {
      parts.push(
        `${weakest.section.charAt(0).toUpperCase() + weakest.section.slice(1)} trails at ${weakest.score}, a ${strongest.score - weakest.score}-point gap worth noting in any pitch.`,
      );
    }

    if (avg >= 80) {
      parts.push("Overall signal strength is high across the board.");
    } else if (avg >= 60) {
      parts.push("Solid signal strength with room to sharpen in weaker areas.");
    }
  }

  const hasFreqs = signalTags.some((t) => t.freq > 1);
  if (hasFreqs) {
    const top3 = signalTags.slice(0, 3).map((t) => t.tag.replace(/_/g, " "));
    if (top3.length > 0) {
      parts.push(
        `Dominant signals: ${top3.join(", ")}. These are the recurring threads to build a conversation around.`,
      );
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function SignalScoresPanel({
  sectionScores,
  signalTags,
}: {
  sectionScores: { section: string; score: number }[];
  signalTags: { tag: string; freq: number }[];
}) {
  if (sectionScores.length === 0 && signalTags.length === 0) return null;

  const maxFreq = signalTags.length > 0 ? Math.max(...signalTags.map((t) => t.freq)) : 1;
  const topTags = signalTags.slice(0, 15);
  const hasFrequencies = signalTags.some((t) => t.freq > 1);
  const summary = buildScoreSummary(sectionScores, signalTags);

  return (
    <section
      aria-label="Signal scores"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Signal scores
      </p>
      <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
        what showed up strongest across the assessment.
      </p>

      {summary && (
        <p className="mt-3 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
          {summary}
        </p>
      )}

      {sectionScores.length > 0 && (
        <div className="mt-5 space-y-2">
          {sectionScores.map(({ section, score }) => {
            const color = SCORE_COLORS[section] ?? "128, 127, 115";
            return (
              <div key={section} className="flex items-center gap-3">
                <span
                  className="w-[100px] shrink-0 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)]"
                  style={{ letterSpacing: "1px" }}
                >
                  {section}
                </span>
                <div
                  className="relative h-[6px] flex-1 overflow-hidden rounded-full"
                  style={{ background: "rgba(253, 245, 230, 0.04)" }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${score}%`,
                      background: `linear-gradient(90deg, rgb(${color}), rgba(${color}, 0.5))`,
                    }}
                  />
                </div>
                <span
                  className="w-8 shrink-0 text-right font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "0.5px" }}
                >
                  {score}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {topTags.length > 0 && (
        <div className="mt-5">
          <p
            className="mb-2 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {hasFrequencies ? "Top signals" : "Tags"}
          </p>
          {hasFrequencies ? (
            <div className="space-y-1.5">
              {topTags.map(({ tag, freq }) => {
                const pct = Math.round((freq / maxFreq) * 100);
                return (
                  <div key={tag} className="flex items-center gap-3">
                    <span
                      className="w-[120px] shrink-0 truncate font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-300)]"
                      style={{ letterSpacing: "1px" }}
                      title={tag.replace(/_/g, " ")}
                    >
                      {tag.replace(/_/g, " ")}
                    </span>
                    <div
                      className="relative h-[6px] flex-1 overflow-hidden rounded-full"
                      style={{ background: "rgba(253, 245, 230, 0.04)" }}
                    >
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: "linear-gradient(90deg, rgb(244, 160, 176), rgba(244, 160, 176, 0.4))",
                        }}
                      />
                    </div>
                    <span
                      className="w-6 shrink-0 text-right font-[family-name:var(--font-label)] text-[10px] tabular-nums text-[color:var(--color-neutral-500)]"
                    >
                      {freq}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTags.map(({ tag }) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
                  style={{
                    letterSpacing: "1.2px",
                    background: "rgba(244, 160, 176, 0.10)",
                    color: "var(--color-brand-pink)",
                  }}
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function KeyInsightsPanel({
  parsedInsights,
  sectionInsights,
}: {
  parsedInsights: ParsedInsight[];
  sectionInsights: { label: string; text: string }[];
}) {
  if (parsedInsights.length === 0 && sectionInsights.length === 0) return null;

  return (
    <section
      aria-label="Key insights"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Key insights
      </p>
      <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
        the observations that matter most.
      </p>

      {parsedInsights.length > 0 && (
        <div className="mt-4 space-y-4">
          {parsedInsights.map((insight, i) => (
            <div
              key={i}
              className="rounded-[8px] px-4 py-3"
              style={{
                background: "rgba(178, 40, 72, 0.06)",
                border: "1px solid rgba(178, 40, 72, 0.12)",
              }}
            >
              <p className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
                {insight.headline}
              </p>
              <p className="mt-2 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
                {insight.followThrough}
              </p>
              {insight.evidence && (
                <p className="mt-2 font-[family-name:var(--font-body)] text-[11px] italic leading-[1.5] text-[color:var(--color-neutral-500)]">
                  {insight.evidence}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {parsedInsights.length === 0 && sectionInsights.length > 0 && (
        <div className="mt-4 space-y-3">
          {sectionInsights.map((insight, i) => (
            <div
              key={i}
              className="rounded-[8px] px-4 py-3"
              style={{
                background: "rgba(178, 40, 72, 0.06)",
                border: "1px solid rgba(178, 40, 72, 0.12)",
              }}
            >
              <p
                className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-pink)]"
                style={{ letterSpacing: "1.2px" }}
              >
                {insight.label}
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-body)] text-[13px] leading-[1.6] text-[color:var(--color-neutral-300)]">
                {insight.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function deriveNextActions(
  profile: BrandDnaProfileRow,
  signalTags: { tag: string; freq: number }[],
): { label: string; detail: string; priority: "high" | "medium" | "low" }[] {
  const actions: { label: string; detail: string; priority: "high" | "medium" | "low" }[] = [];

  if (profile.status === "in_progress") {
    const section = profile.current_section ?? 1;
    actions.push({
      label: "Assessment in progress",
      detail: `Currently on section ${section} of 5. Follow up if they've gone quiet.`,
      priority: "high",
    });
  }

  if (profile.status === "complete" && !profile.brand_pack_json) {
    actions.push({
      label: "Generate Brand Pack",
      detail: "Profile is complete but no Brand Pack has been generated yet. Generate and send the PDF.",
      priority: "high",
    });
  }

  if (profile.status === "complete" && profile.brand_pack_json) {
    actions.push({
      label: "Send Brand Pack",
      detail: "Brand Pack is ready to download and share with the lead.",
      priority: "medium",
    });
  }

  const topSignals = signalTags
    .filter((t) => t.freq > 1)
    .slice(0, 3)
    .map((t) => t.tag.replace(/_/g, " "));
  if (topSignals.length > 0 && profile.status === "complete") {
    actions.push({
      label: "Lead with their values",
      detail: `Strongest signals: ${topSignals.join(", ")}. Frame the conversation around these.`,
      priority: "medium",
    });
  }

  const hasCaution = signalTags.some((t) => t.tag === "risk_caution" && t.freq >= 2);
  const hasAppetite = signalTags.some((t) => t.tag === "risk_appetite" && t.freq >= 2);
  if (hasCaution && !hasAppetite) {
    actions.push({
      label: "Low-risk positioning",
      detail: "They lean cautious. Lead with proof, case studies, and guaranteed outcomes rather than big swings.",
      priority: "medium",
    });
  }
  if (hasAppetite && !hasCaution) {
    actions.push({
      label: "Bold pitch welcome",
      detail: "They have appetite for risk. Pitch the ambitious version. They'll respect directness over safety.",
      priority: "low",
    });
  }

  if (profile.track === "business") {
    actions.push({
      label: "Talk to the brand, not the person",
      detail: "They answered in business mode. Keep the conversation about what the brand needs, not personal style.",
      priority: "low",
    });
  }

  return actions;
}

const ACTION_PRIORITY_STYLE: Record<string, { dot: string; border: string; bg: string }> = {
  high: {
    dot: "var(--color-brand-red)",
    border: "rgba(178, 40, 72, 0.20)",
    bg: "rgba(178, 40, 72, 0.04)",
  },
  medium: {
    dot: "var(--color-brand-orange)",
    border: "rgba(242, 140, 82, 0.15)",
    bg: "rgba(242, 140, 82, 0.04)",
  },
  low: {
    dot: "var(--color-neutral-500)",
    border: "rgba(128, 127, 115, 0.15)",
    bg: "rgba(128, 127, 115, 0.04)",
  },
};

function NextActionsPanel({ actions }: { actions: ReturnType<typeof deriveNextActions> }) {
  if (actions.length === 0) return null;

  return (
    <section
      aria-label="Recommended next actions"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Next actions
      </p>
      <p className="mt-1 font-[family-name:var(--font-narrative)] text-[12px] italic text-[color:var(--color-brand-pink)]">
        what to do with what we know.
      </p>

      <div className="mt-4 space-y-2">
        {actions.map((action, i) => {
          const style = ACTION_PRIORITY_STYLE[action.priority] ?? ACTION_PRIORITY_STYLE.low;
          return (
            <div
              key={i}
              className="flex gap-3 rounded-[8px] px-4 py-3"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            >
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: style.dot }}
              />
              <div className="min-w-0">
                <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                  {action.label}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-body)] text-[12px] leading-[1.5] text-[color:var(--color-neutral-300)]">
                  {action.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BlendSection({ blend }: { blend: BrandDnaBlendRow }) {
  const tags = parseSignalTags(blend.tags_json);
  const divergences = (() => {
    try {
      return JSON.parse(blend.divergences_json) as {
        domain: string;
        tag: string;
        interpretation: string;
      }[];
    } catch {
      return [];
    }
  })();

  const maxFreq = tags.length > 0 ? Math.max(...tags.map((t) => t.freq)) : 1;

  return (
    <section
      aria-label="Company blend"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      <p
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.8px" }}
      >
        Company blend
      </p>
      <p className="mt-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.65] text-[color:var(--color-neutral-300)]">
        {blend.prose_portrait}
      </p>
      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.slice(0, 12).map((t) => {
            const opacity = 0.4 + 0.6 * (t.freq / maxFreq);
            return (
              <span
                key={t.tag}
                className="rounded-full px-2.5 py-1 font-[family-name:var(--font-label)] text-[10px] uppercase"
                style={{
                  letterSpacing: "1.2px",
                  background: `rgba(244, 160, 176, ${0.06 + 0.08 * (t.freq / maxFreq)})`,
                  color: "var(--color-brand-pink)",
                  opacity,
                }}
              >
                {t.tag.replace(/_/g, " ")}
              </span>
            );
          })}
        </div>
      )}
      {divergences.length > 0 && (
        <div className="mt-5">
          <p
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
            style={{ letterSpacing: "1.5px" }}
          >
            Divergence flags
          </p>
          <div className="mt-2 space-y-2">
            {divergences.map((d, i) => (
              <div
                key={i}
                className="rounded-[8px] px-3 py-2"
                style={{
                  background: "rgba(242, 140, 82, 0.06)",
                  border: "1px solid rgba(242, 140, 82, 0.15)",
                }}
              >
                <p className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]" style={{ letterSpacing: "1.2px" }}>
                  {d.domain} · {d.tag}
                </p>
                <p className="mt-1 text-[12px] text-[color:var(--color-neutral-300)]">
                  {d.interpretation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] italic text-[color:var(--color-neutral-500)]">
        Generated {formatDate(blend.created_at_ms)}
      </p>
    </section>
  );
}

function SoloProfileSection({ profile }: { profile: BrandDnaProfileRow }) {
  const signalTags = parseSignalTags(profile.signal_tags);
  const sectionScores = parseSectionScores(profile.section_scores);
  const sectionInsights = parseSectionInsights(profile.section_insights);
  const portraitText = extractPortraitText(profile.prose_portrait);
  const parsedInsights = parseKeyInsights(profile.prose_portrait);
  const nextActions = deriveNextActions(profile, signalTags);

  return (
    <>
      <section
        aria-label="Brand DNA profile"
        className="rounded-[12px] p-5"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div className="flex items-start justify-between">
          <p
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.8px" }}
          >
            {profile.track === "business" ? "Brand profile" : "Founder profile"}
            {profile.subject_display_name ? ` · ${profile.subject_display_name}` : ""}
          </p>
          <ProfileStatusBadge status={profile.status} />
        </div>

        {profile.first_impression && (
          <p className="mt-4 font-[family-name:var(--font-narrative)] text-[15px] italic leading-[1.55] text-[color:var(--color-brand-pink)]">
            {profile.first_impression}
          </p>
        )}
        {portraitText && (
          <div className="mt-3 space-y-3">
            {portraitText.split("\n\n").map((para, i) => (
              <p key={i} className="font-[family-name:var(--font-body)] text-[14px] leading-[1.65] text-[color:var(--color-neutral-300)]">
                {para}
              </p>
            ))}
          </div>
        )}
        {profile.completed_at_ms && (
          <p className="mt-4 text-[11px] italic text-[color:var(--color-neutral-500)]">
            Completed {formatDate(profile.completed_at_ms)}
          </p>
        )}
      </section>

      <SignalScoresPanel sectionScores={sectionScores} signalTags={signalTags} />
      <KeyInsightsPanel parsedInsights={parsedInsights} sectionInsights={sectionInsights} />
      <NextActionsPanel actions={nextActions} />
    </>
  );
}

export function BrandDnaTab({
  companyId,
  companyShape,
  profiles,
  blend,
  contacts,
}: {
  companyId: string;
  companyShape: CompanyShape;
  profiles: BrandDnaProfileRow[];
  blend: BrandDnaBlendRow | null;
  contacts: ContactRow[];
}) {
  const currentProfiles = profiles.filter((p) => p.is_current);
  const completeProfiles = currentProfiles.filter((p) => p.status === "complete");
  const isSolo = companyShape === "solo_founder" || currentProfiles.length <= 1;

  if (currentProfiles.length === 0) {
    return (
      <div className="px-4 pb-10">
        <div className="px-8 py-10 text-center">
          <p
            className="font-[family-name:var(--font-display)] leading-none text-[color:var(--color-brand-cream)]"
            style={{ fontSize: "24px", letterSpacing: "-0.2px" }}
          >
            No Brand DNA yet.
          </p>
          <p className="mt-3 font-[family-name:var(--font-narrative)] text-[13px] italic text-[color:var(--color-brand-pink)]">
            they haven&rsquo;t told us who they are.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-10">
      {isSolo && (completeProfiles[0] ?? currentProfiles[0]) ? (
        <SoloProfileSection profile={completeProfiles[0] ?? currentProfiles[0]} />
      ) : blend ? (
        <BlendSection blend={blend} />
      ) : completeProfiles.length >= 2 ? (
        <div
          className="rounded-[12px] px-5 py-4"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <p className="text-[13px] text-[color:var(--color-neutral-300)]">
            {completeProfiles.length} profiles complete — blend generation pending.
          </p>
        </div>
      ) : null}

      {!isSolo && (
        <section
          aria-label="Individual profiles"
          className="overflow-hidden rounded-[12px]"
          style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
        >
          <div
            className="flex items-baseline justify-between px-5 py-3"
            style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
          >
            <h2
              className="font-[family-name:var(--font-label)] text-[11px] uppercase text-[color:var(--color-neutral-300)]"
              style={{ letterSpacing: "1.8px" }}
            >
              Individual profiles
            </h2>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {currentProfiles.length}
            </span>
          </div>
          <div>
            {currentProfiles.map((profile) => {
              const contact = contacts.find((c) => c.id === profile.contact_id);
              return (
                <div
                  key={profile.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[color:var(--color-brand-cream)]">
                      {profile.subject_display_name ?? contact?.name ?? "Unknown"}
                    </p>
                    {profile.completed_at_ms && (
                      <p className="text-[11px] italic text-[color:var(--color-neutral-500)]">
                        Completed {formatDate(profile.completed_at_ms)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <ProfileStatusBadge status={profile.status} />
                    {contact && (
                      <Link
                        href={`/lite/admin/contacts/${contact.id}?tab=brand-dna`}
                        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
                        style={{ letterSpacing: "1.5px" }}
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
