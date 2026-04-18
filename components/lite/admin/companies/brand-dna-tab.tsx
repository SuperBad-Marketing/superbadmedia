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

function parseTags(json: string | null): Record<string, Record<string, number>> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, Record<string, number>>;
  } catch {
    return {};
  }
}

function flattenTags(tagMap: Record<string, Record<string, number>>): { tag: string; freq: number }[] {
  const flat: { tag: string; freq: number }[] = [];
  for (const domain of Object.values(tagMap)) {
    for (const [tag, freq] of Object.entries(domain)) {
      flat.push({ tag, freq });
    }
  }
  return flat.sort((a, b) => b.freq - a.freq).slice(0, 12);
}

function TagCloud({ tags }: { tags: { tag: string; freq: number }[] }) {
  if (tags.length === 0) return null;
  const maxFreq = Math.max(...tags.map((t) => t.freq));
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
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
            {t.tag}
          </span>
        );
      })}
    </div>
  );
}

function BlendSection({ blend }: { blend: BrandDnaBlendRow }) {
  const tags = flattenTags(parseTags(blend.tags_json));
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
        <div className="mt-4">
          <TagCloud tags={tags} />
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
  const tags = flattenTags(parseTags(profile.signal_tags));
  return (
    <section
      aria-label="Brand DNA profile"
      className="rounded-[12px] p-5"
      style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
    >
      {profile.first_impression && (
        <p className="font-[family-name:var(--font-narrative)] text-[15px] italic leading-[1.55] text-[color:var(--color-brand-pink)]">
          {profile.first_impression}
        </p>
      )}
      {profile.prose_portrait && (
        <p className="mt-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.65] text-[color:var(--color-neutral-300)]">
          {profile.prose_portrait}
        </p>
      )}
      {tags.length > 0 && (
        <div className="mt-4">
          <TagCloud tags={tags} />
        </div>
      )}
      {profile.completed_at_ms && (
        <p className="mt-3 text-[11px] italic text-[color:var(--color-neutral-500)]">
          Completed {formatDate(profile.completed_at_ms)}
        </p>
      )}
    </section>
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
      {isSolo && completeProfiles[0] ? (
        <SoloProfileSection profile={completeProfiles[0]} />
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
