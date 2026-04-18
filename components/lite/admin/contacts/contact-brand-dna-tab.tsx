import type { BrandDnaProfileRow } from "@/lib/db/schema/brand-dna-profiles";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Australia/Melbourne",
  });
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

export function ContactBrandDnaTab({
  profiles,
}: {
  profiles: BrandDnaProfileRow[];
}) {
  const currentProfiles = profiles.filter((p) => p.is_current);
  const latestComplete = currentProfiles.find((p) => p.status === "complete");
  const previousVersions = profiles.filter((p) => !p.is_current && p.status === "complete");

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
            still a stranger.
          </p>
        </div>
      </div>
    );
  }

  const current = latestComplete ?? currentProfiles[0];
  const tags = flattenTags(parseTags(current.signal_tags));

  return (
    <div className="space-y-5 px-4 pb-10">
      <section
        aria-label="Brand DNA profile"
        className="rounded-[12px] p-5"
        style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
      >
        <div className="flex items-center justify-between">
          <p
            className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.8px" }}
          >
            Individual profile
          </p>
          <ProfileStatusBadge status={current.status} />
        </div>

        {current.first_impression && (
          <p className="mt-4 font-[family-name:var(--font-narrative)] text-[15px] italic leading-[1.55] text-[color:var(--color-brand-pink)]">
            {current.first_impression}
          </p>
        )}

        {current.prose_portrait && (
          <p className="mt-3 font-[family-name:var(--font-body)] text-[14px] leading-[1.65] text-[color:var(--color-neutral-300)]">
            {current.prose_portrait}
          </p>
        )}

        {tags.length > 0 && (
          <div className="mt-4">
            <TagCloud tags={tags} />
          </div>
        )}

        {current.completed_at_ms && (
          <p className="mt-3 text-[11px] italic text-[color:var(--color-neutral-500)]">
            Completed {formatDate(current.completed_at_ms)}
          </p>
        )}
      </section>

      {previousVersions.length > 0 && (
        <section
          aria-label="Retake history"
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
              Retake history
            </h2>
            <span
              className="font-[family-name:var(--font-label)] text-[11px] tabular-nums text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {previousVersions.length}
            </span>
          </div>
          <div>
            {previousVersions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.03)" }}
              >
                <p className="text-[12px] text-[color:var(--color-neutral-300)]">
                  {version.completed_at_ms
                    ? formatDate(version.completed_at_ms)
                    : "Unknown date"}
                </p>
                <span
                  className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                  style={{ letterSpacing: "1.5px" }}
                >
                  Previous
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
