"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_PRIMARY,
  type AdminNavItem,
  matchActiveId,
} from "@/components/lite/admin-shell-nav";

const BOTTOM_NAV_IDS = [
  "cockpit",
  "pipeline",
  "inbox",
  "tasks",
  "settings",
] as const;

const bottomItems: AdminNavItem[] = ADMIN_NAV_PRIMARY.filter((item) =>
  (BOTTOM_NAV_IDS as readonly string[]).includes(item.id),
);

export function AdminBottomNav() {
  const pathname = usePathname() ?? "";
  const activeId = useMemo(
    () => matchActiveId(pathname, [...ADMIN_NAV_PRIMARY]),
    [pathname],
  );

  return (
    <nav
      aria-label="Admin navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        backgroundColor: "var(--color-surface-1)",
        borderTop: "1px solid var(--color-neutral-700)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <ul className="flex items-center justify-around px-2 py-1.5">
        {bottomItems.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link
                href={item.href ?? "#"}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-sm px-3 py-1.5 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
                )}
              >
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  aria-hidden
                  style={{
                    color: isActive
                      ? "var(--color-accent-cta)"
                      : "var(--color-neutral-500)",
                  }}
                />
                <span
                  className="text-[10px] font-[family-name:var(--font-dm-sans)]"
                  style={{
                    color: isActive
                      ? "var(--color-neutral-100)"
                      : "var(--color-neutral-500)",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
