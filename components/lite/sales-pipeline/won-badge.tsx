import type { DealWonOutcome } from "@/lib/db/schema/deals";

/**
 * Won-card outcome badge (sales-pipeline §5.4). Black Han Sans caption
 * appearance. RETAINER = pink bg / cream text; SAAS = orange bg / charcoal.
 * PROJECT renders no badge (spec only names the two).
 *
 * Flagged in PATCHES_OWED: this is a 9th BHS location and the design-system
 * baseline §6 closed list is locked at 8. Baseline spec update owed.
 */
export function WonBadge({ outcome }: { outcome: DealWonOutcome | null }) {
  if (outcome === "retainer") {
    return (
      <span
        data-slot="won-badge"
        className="font-[family-name:var(--font-black-han-sans)] rounded-sm px-1.5 py-0.5 text-[10px] tracking-wider"
        style={{
          background: "var(--brand-pink)",
          color: "var(--color-cream, oklch(0.96 0.02 85))",
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
        className="font-[family-name:var(--font-black-han-sans)] rounded-sm px-1.5 py-0.5 text-[10px] tracking-wider"
        style={{
          background: "var(--brand-orange)",
          color: "var(--color-charcoal, oklch(0.22 0.01 70))",
        }}
      >
        SAAS
      </span>
    );
  }
  return null;
}
