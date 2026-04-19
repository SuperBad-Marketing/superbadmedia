import Link from "next/link";

const TABS = [
  { label: "Queue", href: "/lite/admin/lead-gen", active: true },
  { label: "Runs", href: "/lite/admin/lead-gen/runs", active: true },
  { label: "Metrics", href: "/lite/admin/lead-gen/metrics", active: true },
  { label: "DNC", href: "/lite/admin/lead-gen/dnc", active: true },
] as const;

interface LeadGenTabsProps {
  currentPath: string;
}

export function LeadGenTabs({ currentPath }: LeadGenTabsProps) {
  return (
    <div
      className="mb-8 flex items-center gap-1"
      style={{ borderBottom: "1px solid rgba(253, 245, 230, 0.05)" }}
    >
      {TABS.map((tab) => {
        if (!tab.active || !tab.href) {
          return (
            <span
              key={tab.label}
              className="cursor-not-allowed px-3 pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
              style={{ letterSpacing: "1.5px" }}
            >
              {tab.label}
            </span>
          );
        }

        const isActive = currentPath === tab.href;

        return (
          <Link
            key={tab.label}
            href={tab.href}
            className="px-3 pb-3 font-[family-name:var(--font-label)] text-[10px] uppercase transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              letterSpacing: "1.5px",
              color: isActive
                ? "var(--color-brand-cream)"
                : "var(--color-neutral-500)",
              borderBottom: isActive
                ? "2px solid var(--color-brand-red)"
                : "2px solid transparent",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
