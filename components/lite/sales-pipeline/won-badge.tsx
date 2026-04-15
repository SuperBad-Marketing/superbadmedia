import type { DealWonOutcome } from "@/lib/db/schema/deals";

/**
 * Won-card outcome badge (sales-pipeline §5.4).
 *
 * Rule 02 of mockup-admin-interior.html §13 — eyebrows and chips are
 * Righteous, all-caps, tracked ≥1.5px. Previously Black Han Sans; swapped
 * in admin-polish-1.
 *
 * RETAINER = pink bg / charcoal text; SAAS = orange bg / charcoal text.
 * PROJECT renders no badge (spec only names the two).
 */
export function WonBadge({ outcome }: { outcome: DealWonOutcome | null }) {
  if (outcome === "retainer") {
    return (
      <span
        data-slot="won-badge"
        className="rounded-sm px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{
          background: "var(--color-brand-pink)",
          color: "var(--color-brand-charcoal)",
          letterSpacing: "1.8px",
        }}
      >
        RETAINER
      </span>
    );
  }
  if (outcome === "saas") {
    return (
      <span
        data-slot="won-badge"
        className="rounded-sm px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase"
        style={{
          background: "var(--color-brand-orange)",
          color: "var(--color-brand-charcoal)",
          letterSpacing: "1.8px",
        }}
      >
        SAAS
      </span>
    );
  }
  return null;
}
