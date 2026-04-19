/**
 * Shared tab navigation for /lite/content/* routes (CE-8).
 *
 * Server component — uses pathname from prop to highlight active tab.
 * Inactive tabs that haven't shipped yet stay as disabled spans.
 */
import Link from "next/link";

const TABS = [
  { label: "Review", href: "/lite/content", active: true },
  { label: "Social", href: "/lite/content/social", active: true },
  { label: "Metrics", href: "/lite/content/metrics", active: true },
  { label: "Topics", href: "/lite/content/topics", active: true },
  { label: "List", href: "/lite/content/list", active: true },
] as const;

interface ContentTabsProps {
  currentPath: string;
}

export function ContentTabs({ currentPath }: ContentTabsProps) {
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
