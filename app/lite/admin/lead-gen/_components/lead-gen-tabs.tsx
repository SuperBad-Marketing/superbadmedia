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
