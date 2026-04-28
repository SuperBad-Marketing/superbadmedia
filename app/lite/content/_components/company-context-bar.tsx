"use client";

/**
 * Shared company context bar for all /lite/content/* pages.
 *
 * Displays the active company prominently and lets the admin switch.
 * Selection persists via `?company=<id>` search param so it survives
 * tab navigation and page refreshes.
 */
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface CompanyContextBarProps {
  companies: Array<{ id: string; name: string }>;
  activeCompanyId: string;
}

export function CompanyContextBar({
  companies,
  activeCompanyId,
}: CompanyContextBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeName =
    companies.find((c) => c.id === activeCompanyId)?.name ?? "Unknown";

  if (companies.length <= 1) {
    return (
      <div
        className="mb-1 flex items-center gap-2 px-4 pt-2"
        style={{ minHeight: "28px" }}
      >
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Content for
        </span>
        <span
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          {activeName}
        </span>
      </div>
    );
  }

  function handleChange(companyId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("company", companyId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      className="mb-1 flex items-center gap-3 px-4 pt-2"
      style={{ minHeight: "28px" }}
    >
      <span
        className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
        style={{ letterSpacing: "1.5px" }}
      >
        Content for
      </span>
      <select
        value={activeCompanyId}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded border border-[rgba(253,245,230,0.08)] bg-[color:var(--color-surface-3)] px-2 py-0.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-cream)] outline-none focus:border-[color:var(--color-brand-pink)]"
        style={{ letterSpacing: "1.5px" }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
