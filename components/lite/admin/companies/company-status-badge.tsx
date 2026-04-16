/**
 * §5 status chip for companies. Mirrors InvoiceStatusBadge recipe:
 * Righteous 10px / 1.5px tracking, rgba-tinted, 1×1 currentColor dot.
 *
 * Status is derived at the call site (no `status` column on companies yet —
 * see PATCHES_OWED `admin_polish_4_company_status_column`). Inputs:
 *  - `archived` → do_not_contact === true
 *  - `active`   → has at least one won deal
 *  - `prospect` → has no won deals (not archived)
 */
export type CompanyDerivedStatus = "prospect" | "active" | "archived";

const TONE: Record<CompanyDerivedStatus, { bg: string; color: string }> = {
  prospect: {
    bg: "rgba(244, 160, 176, 0.10)",
    color: "var(--color-brand-pink)",
  },
  active: {
    bg: "rgba(123, 174, 126, 0.14)",
    color: "var(--color-success)",
  },
  archived: {
    bg: "rgba(128, 127, 115, 0.15)",
    color: "var(--color-neutral-500)",
  },
};

const LABEL: Record<CompanyDerivedStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  archived: "Archived",
};

export function CompanyStatusBadge({
  status,
}: {
  status: CompanyDerivedStatus;
}) {
  const tone = TONE[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {LABEL[status]}
    </span>
  );
}
