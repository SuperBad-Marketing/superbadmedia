"use client";

interface DiagnosisData {
  hypothesis?: string;
  confidence?: "high" | "med" | "low";
  recommended_action?: string;
  timeline_markdown?: string;
}

const CONFIDENCE_STYLES: Record<string, { bg: string; color: string }> = {
  high: { bg: "rgba(123, 174, 126, 0.14)", color: "var(--color-success)" },
  med: { bg: "rgba(242, 140, 82, 0.18)", color: "var(--color-warning)" },
  low: { bg: "rgba(178, 40, 72, 0.18)", color: "var(--color-error)" },
};

export function DiagnosisCard({
  diagnosis,
}: {
  diagnosis: unknown;
}) {
  if (!diagnosis || typeof diagnosis !== "object") {
    return (
      <section
        className="rounded-[var(--radius-generous)] p-5"
        style={{ background: "var(--color-surface-1)" }}
      >
        <h2
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Claude Diagnosis
        </h2>
        <p
          className="mt-3 font-[family-name:var(--font-serif)] text-[14px] italic"
          style={{ color: "var(--color-neutral-500)" }}
        >
          Diagnosis pending. The diagnoser may still be running.
        </p>
      </section>
    );
  }

  const d = diagnosis as DiagnosisData;
  const confStyle = CONFIDENCE_STYLES[d.confidence ?? "low"] ?? CONFIDENCE_STYLES.low;

  return (
    <section
      className="rounded-[var(--radius-generous)] p-5"
      style={{ background: "var(--color-surface-1)" }}
    >
      <div className="flex items-baseline justify-between">
        <h2
          className="font-[family-name:var(--font-label)] text-[10px] uppercase"
          style={{ letterSpacing: "2px", color: "var(--color-neutral-500)" }}
        >
          Claude Diagnosis
        </h2>
        {d.confidence && (
          <span
            className="rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
            style={{
              letterSpacing: "1.5px",
              background: confStyle.bg,
              color: confStyle.color,
            }}
          >
            {d.confidence} confidence
          </span>
        )}
      </div>

      {d.hypothesis && (
        <p
          className="mt-4 text-[15px] leading-relaxed"
          style={{ color: "var(--color-neutral-300)" }}
        >
          {d.hypothesis}
        </p>
      )}

      {d.recommended_action && (
        <div className="mt-4">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Recommended
          </div>
          <p
            className="mt-1 text-[14px]"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {d.recommended_action}
          </p>
        </div>
      )}

      {d.timeline_markdown && (
        <div className="mt-4 border-t border-[var(--color-surface-2)] pt-3">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase"
            style={{ letterSpacing: "1.5px", color: "var(--color-neutral-500)" }}
          >
            Timeline
          </div>
          <p
            className="mt-1 whitespace-pre-wrap font-[family-name:var(--font-mono)] text-[12px] leading-relaxed"
            style={{ color: "var(--color-neutral-500)" }}
          >
            {d.timeline_markdown}
          </p>
        </div>
      )}
    </section>
  );
}
