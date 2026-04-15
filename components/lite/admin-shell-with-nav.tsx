"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGroup, motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"
import { houseSpring } from "@/lib/design-tokens"
import { AdminShell } from "@/components/lite/admin-shell"
import {
  ADMIN_NAV_PRIMARY,
  ADMIN_NAV_UTILITY,
  ADMIN_PROFILE_CHIP,
  type AdminNavItem,
  matchActiveId,
} from "@/components/lite/admin-shell-nav"

/**
 * AdminShellWithNav — consumes `AdminShell` and hydrates the sidebar
 * with the static nav definition + live active-state resolution.
 *
 * Active-state motion: the pink indicator bar is a single motion layer
 * shared across nav items via `layoutId`, so route change animates the
 * bar between items with `houseSpring`. Reduced-motion falls back to an
 * instant reposition without breaking layout.
 *
 * Chrome only — this component does not enforce auth. Each admin page
 * keeps its own `auth()` + `role !== "admin"` redirect.
 */
export function AdminShellWithNav({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname() ?? ""
  const allItems = React.useMemo(
    () => [...ADMIN_NAV_PRIMARY, ...ADMIN_NAV_UTILITY],
    [],
  )
  const activeId = React.useMemo(
    () => matchActiveId(pathname, allItems),
    [pathname, allItems],
  )

  const sidebar = (
    <div className="flex h-full flex-col gap-8">
      <Link
        href="/lite"
        className="block outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)] rounded-sm"
        aria-label="SuperBad — back to cockpit"
      >
        <span className="block font-[family-name:var(--font-pacifico)] text-[2rem] leading-none text-[color:var(--color-neutral-100)]">
          SuperBad
        </span>
      </Link>

      <LayoutGroup id="admin-nav">
        <nav aria-label="Admin" className="flex flex-1 flex-col gap-6 min-h-0">
          <AdminNavGroup
            items={ADMIN_NAV_PRIMARY}
            activeId={activeId}
          />

          <div className="border-t border-[color:var(--color-neutral-700)]" aria-hidden />

          <AdminNavGroup
            items={ADMIN_NAV_UTILITY}
            activeId={activeId}
          />

          <div className="flex-1" aria-hidden />

          <ProfileChip />
        </nav>
      </LayoutGroup>
    </div>
  )

  return (
    <div data-density="comfort">
      <AdminShell sidebar={sidebar}>{children}</AdminShell>
    </div>
  )
}

function AdminNavGroup({
  items,
  activeId,
}: {
  items: readonly AdminNavItem[]
  activeId: string | null
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <AdminNavRow item={item} isActive={item.id === activeId} />
        </li>
      ))}
    </ul>
  )
}

function AdminNavRow({
  item,
  isActive,
}: {
  item: AdminNavItem
  isActive: boolean
}) {
  const reducedMotion = useReducedMotion()
  const Icon = item.icon
  const isSoon = item.status === "soon"

  const contents = (
    <span
      className={cn(
        "relative flex items-center gap-3 py-2 pl-4 pr-3 rounded-sm",
        "font-[family-name:var(--font-dm-sans)] text-[color:var(--color-neutral-300)]",
        !isSoon &&
          "transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
        !isSoon && isActive && "text-[color:var(--color-neutral-100)]",
        isSoon && "text-[color:var(--color-neutral-500)] cursor-not-allowed",
      )}
    >
      {isActive && !isSoon && (
        <motion.span
          layoutId="admin-nav-active-bar"
          aria-hidden
          className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[color:var(--color-accent-cta)]"
          transition={reducedMotion ? { duration: 0 } : houseSpring}
        />
      )}
      <Icon
        size={20}
        strokeWidth={1.5}
        aria-hidden
        className="shrink-0"
      />
      <span className="flex-1 text-[length:var(--text-body)]">{item.label}</span>
      {isSoon && (
        <span
          className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-500)]"
          aria-hidden
        >
          Soon
        </span>
      )}
    </span>
  )

  if (isSoon || !item.href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${item.label} — coming soon`}
        className="block"
      >
        {contents}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className="block outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)] rounded-sm"
    >
      {contents}
    </Link>
  )
}

function ProfileChip() {
  const Icon = ADMIN_PROFILE_CHIP.icon
  return (
    <Link
      href={ADMIN_PROFILE_CHIP.href}
      className="group flex items-center gap-3 rounded-sm p-2 outline-none transition-colors hover:bg-[color:var(--color-surface-2)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]"
      aria-label={`${ADMIN_PROFILE_CHIP.name} — open settings`}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[color:var(--color-surface-2)] text-[color:var(--color-neutral-100)] group-hover:bg-[color:var(--color-surface-3)]"
      >
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <span className="flex flex-1 flex-col leading-tight">
        <span className="font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)] text-[color:var(--color-neutral-100)]">
          {ADMIN_PROFILE_CHIP.name}
        </span>
        <span className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-accent-cta)]">
          {ADMIN_PROFILE_CHIP.role}
        </span>
      </span>
    </Link>
  )
}
