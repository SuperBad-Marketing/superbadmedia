"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboardIcon,
  ClipboardListIcon,
  FileTextIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";
import { brand, neutral, houseSpring } from "@/lib/design-tokens";

const NAV_ITEMS = [
  { key: "home", href: "/bench", label: "Home", icon: LayoutDashboardIcon },
  { key: "assignments", href: "/bench/assignments", label: "Assignments", icon: ClipboardListIcon },
  { key: "invoices", href: "/bench/invoices", label: "Invoices", icon: FileTextIcon },
  { key: "availability", href: "/bench/availability", label: "Availability", icon: CalendarIcon },
  { key: "profile", href: "/bench/profile", label: "Profile", icon: UserIcon },
] as const;

interface BenchShellProps {
  candidateName: string;
  children: React.ReactNode;
}

export function BenchShell({ candidateName, children }: BenchShellProps) {
  const pathname = usePathname();

  const activeKey = NAV_ITEMS.find((item) => {
    if (item.href === "/bench") return pathname === "/bench";
    return pathname.startsWith(item.href);
  })?.key ?? "home";

  const firstName = candidateName.split(" ")[0];

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-surface-0)]">
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: neutral[300], backgroundColor: "var(--color-surface-0)" }}
      >
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: brand.orange }}
        >
          SuperBad
        </span>
        <span
          className="text-xs"
          style={{ color: neutral[500] }}
        >
          {firstName}
        </span>
      </header>

      <main className="flex-1 px-5 py-6">
        {children}
      </main>

      <nav
        className="sticky bottom-0 z-30 flex items-center justify-around border-t py-2"
        style={{ borderColor: neutral[300], backgroundColor: "var(--color-surface-0)" }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeKey === item.key;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1"
            >
              {isActive && (
                <motion.div
                  layoutId="bench-nav-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{ backgroundColor: `${brand.orange}10` }}
                  transition={houseSpring}
                />
              )}
              <Icon
                size={20}
                strokeWidth={isActive ? 2 : 1.5}
                style={{ color: isActive ? brand.orange : neutral[500] }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? brand.orange : neutral[500] }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
