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
    <div className="mb-8 flex items-center gap-6 border-b border-border">
      {TABS.map((tab) => {
        if (!tab.active || !tab.href) {
          return (
            <span
              key={tab.label}
              className="pb-2 text-sm text-muted-foreground cursor-not-allowed"
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
            className={
              isActive
                ? "border-b-2 border-foreground pb-2 text-sm font-medium"
                : "pb-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
