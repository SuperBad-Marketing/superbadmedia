import {
  Building2,
  FileText,
  GaugeCircle,
  Inbox,
  LayoutGrid,
  type LucideIcon,
  Package,
  Settings,
  TriangleAlert,
  User,
} from "lucide-react"

export type AdminNavItem = {
  id: string
  label: string
  href: string | null
  icon: LucideIcon
  status: "live" | "soon"
  matchPrefix: string | null
}

/**
 * ADMIN_NAV — static nav definition for every /lite/admin surface.
 *
 * Primary cluster mirrors the six nav items named by
 * `docs/specs/design-system-baseline.md §AdminShell`.
 * Utility cluster adds the two admin surfaces that already exist
 * (Invoices, Errors) and earn a slot today.
 *
 * `status: "soon"` items render visually muted + `aria-disabled`. They
 * flip to `"live"` when their landing page ships in a later session
 * (UI-1 unlocks Inbox; a cockpit session unlocks Cockpit; a clients-
 * index session unlocks Clients).
 *
 * `matchPrefix` is used by `<AdminShellWithNav>` for active-state
 * resolution against `usePathname()`. Null = never matches (Soon).
 */
export const ADMIN_NAV_PRIMARY: readonly AdminNavItem[] = [
  {
    id: "cockpit",
    label: "Cockpit",
    href: null,
    icon: GaugeCircle,
    status: "soon",
    matchPrefix: null,
  },
  {
    id: "pipeline",
    label: "Pipeline",
    href: "/lite/admin/pipeline",
    icon: LayoutGrid,
    status: "live",
    matchPrefix: "/lite/admin/pipeline",
  },
  {
    id: "inbox",
    label: "Inbox",
    href: null,
    icon: Inbox,
    status: "soon",
    matchPrefix: null,
  },
  {
    id: "clients",
    label: "Clients",
    href: null,
    icon: Building2,
    status: "soon",
    matchPrefix: null,
  },
  {
    id: "products",
    label: "Products",
    href: "/lite/admin/products",
    icon: Package,
    status: "live",
    matchPrefix: "/lite/admin/products",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/lite/admin/settings/catalogue",
    icon: Settings,
    status: "live",
    matchPrefix: "/lite/admin/settings",
  },
] as const

export const ADMIN_NAV_UTILITY: readonly AdminNavItem[] = [
  {
    id: "invoices",
    label: "Invoices",
    href: "/lite/admin/invoices",
    icon: FileText,
    status: "live",
    matchPrefix: "/lite/admin/invoices",
  },
  {
    id: "errors",
    label: "Errors",
    href: "/lite/admin/errors",
    icon: TriangleAlert,
    status: "live",
    matchPrefix: "/lite/admin/errors",
  },
] as const

export const ADMIN_PROFILE_CHIP = {
  name: "Andy",
  role: "admin",
  href: "/lite/admin/settings/catalogue",
  icon: User,
} as const

export function matchActiveId(
  pathname: string,
  items: readonly AdminNavItem[],
): string | null {
  let best: { id: string; len: number } | null = null
  for (const item of items) {
    if (!item.matchPrefix) continue
    if (pathname === item.matchPrefix || pathname.startsWith(item.matchPrefix + "/")) {
      if (!best || item.matchPrefix.length > best.len) {
        best = { id: item.id, len: item.matchPrefix.length }
      }
    }
  }
  return best?.id ?? null
}
