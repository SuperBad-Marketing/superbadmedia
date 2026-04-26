"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  AlertOctagon,
  AtSign,
  Building2,
  CalendarDays,
  Circle,
  Focus,
  Globe,
  Inbox as InboxIcon,
  LayoutGrid,
  LifeBuoy,
  Moon,
  Newspaper,
  Package,
  PencilLine,
  Radar,
  RefreshCw,
  Send,
  Settings,
  Trash2,
  VolumeX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { houseSpring } from "@/lib/design-tokens";
import type {
  InboxAddressFilter,
  InboxView,
} from "../_queries/list-threads";

type ViewEntry = {
  id: InboxView;
  label: string;
  icon: typeof InboxIcon;
};

type AddressEntry = {
  id: InboxAddressFilter;
  label: string;
};

const VIEWS: readonly ViewEntry[] = [
  { id: "focus", label: "Focus", icon: Focus },
  { id: "all", label: "All", icon: InboxIcon },
  { id: "noise", label: "Noise", icon: VolumeX },
  { id: "support", label: "Support", icon: LifeBuoy },
  { id: "drafts", label: "Drafts", icon: PencilLine },
  { id: "sent", label: "Sent", icon: Send },
  { id: "snoozed", label: "Snoozed", icon: Moon },
  { id: "trash", label: "Trash", icon: Trash2 },
  { id: "spam", label: "Spam", icon: AlertOctagon },
];

const ADDRESSES: readonly AddressEntry[] = [
  { id: "all", label: "All addresses" },
  { id: "andy@", label: "andy@" },
  { id: "support@", label: "support@" },
];

function buildHref(view: InboxView, address: InboxAddressFilter): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  return `/lite/inbox?${params.toString()}`;
}

function buildAddressHref(
  view: InboxView,
  address: InboxAddressFilter,
): string {
  const params = new URLSearchParams();
  params.set("view", view);
  if (address !== "all") params.set("address", address);
  return `/lite/inbox?${params.toString()}`;
}

export function ViewFilterTabs({
  activeView,
  activeAddress,
  onComposeClick,
  onSyncClick,
  syncing,
  counts,
}: {
  activeView: InboxView;
  activeAddress: InboxAddressFilter;
  onComposeClick: () => void;
  onSyncClick: () => void;
  syncing: boolean;
  counts?: Partial<Record<InboxView, number>>;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <nav
      aria-label="Inbox views"
      className="flex h-full flex-col gap-6 p-5"
    >
      <div className="flex flex-col gap-2">
        <Link
          href="/lite/cockpit"
          className="inline-flex items-center gap-1.5 rounded-sm py-1 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)] font-[family-name:var(--font-dm-sans)] text-[12px] text-[color:var(--color-neutral-400)] transition-colors hover:text-[color:var(--color-neutral-100)]"
          aria-label="Back to cockpit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Cockpit
        </Link>
        <span className="block font-[family-name:var(--font-pacifico)] text-[1.75rem] leading-none text-[color:var(--color-neutral-100)]">
          SuperBad
        </span>
      </div>

      <button
        type="button"
        onClick={onComposeClick}
        className={cn(
          "flex items-center justify-center gap-2 rounded-sm px-4 py-2.5",
          "bg-[color:var(--color-accent-cta)] text-[color:var(--color-neutral-100)]",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
          "outline-none transition-[filter] hover:brightness-110",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)]",
        )}
      >
        <PencilLine size={16} strokeWidth={1.75} aria-hidden />
        <span>Compose</span>
      </button>

      <button
        type="button"
        onClick={onSyncClick}
        disabled={syncing}
        aria-label="Sync with Outlook"
        className={cn(
          "flex items-center justify-center gap-2 rounded-sm px-4 py-2",
          "border border-[color:var(--color-neutral-700)] text-[color:var(--color-neutral-400)]",
          "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
          "outline-none transition-colors hover:border-[color:var(--color-neutral-500)] hover:text-[color:var(--color-neutral-200)]",
          "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)]",
          "focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-1)]",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <RefreshCw
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={cn("shrink-0", syncing && "animate-spin")}
        />
        <span>{syncing ? "Syncing…" : "Sync"}</span>
      </button>

      <LayoutGroup id="inbox-view-nav">
        <ul className="flex flex-col gap-0.5">
          {VIEWS.map((item) => {
            const isActive = item.id === activeView;
            const Icon = item.icon;
            const count = counts?.[item.id];
            return (
              <li key={item.id}>
                <Link
                  href={buildHref(item.id, activeAddress)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-sm py-2 pl-4 pr-3",
                    "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-body)]",
                    "text-[color:var(--color-neutral-300)] outline-none",
                    "transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)]",
                    isActive && "text-[color:var(--color-neutral-100)]",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="inbox-view-active-bar"
                      aria-hidden
                      className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[color:var(--color-accent-cta)]"
                      transition={reducedMotion ? { duration: 0 } : houseSpring}
                    />
                  )}
                  <Icon size={18} strokeWidth={1.5} aria-hidden className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {typeof count === "number" && count > 0 && (
                    <span className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-500)]">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>

      <div
        className="border-t border-[color:var(--color-neutral-700)]"
        aria-hidden
      />

      <div className="flex flex-col gap-2">
        <span
          className="font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          From
        </span>
        <ul className="flex flex-col gap-0.5">
          {ADDRESSES.map((item) => {
            const isActive = item.id === activeAddress;
            return (
              <li key={item.id}>
                <Link
                  href={buildAddressHref(activeView, item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-sm py-1.5 pl-4 pr-3",
                    "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                    "text-[color:var(--color-neutral-300)] outline-none",
                    "transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
                    "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)]",
                    isActive && "text-[color:var(--color-neutral-100)]",
                  )}
                >
                  {item.id === "all" ? (
                    <Globe size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />
                  ) : (
                    <AtSign size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />
                  )}
                  <span>{item.label}</span>
                  {isActive && (
                    <Circle
                      size={6}
                      strokeWidth={0}
                      aria-hidden
                      className="ml-auto fill-[color:var(--color-accent-cta)] text-[color:var(--color-accent-cta)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex-1" aria-hidden />

      <div
        className="border-t border-[color:var(--color-neutral-700)]"
        aria-hidden
      />

      <div className="flex flex-col gap-1">
        <span
          className="mb-1 font-[family-name:var(--font-righteous)] text-[length:var(--text-micro)] uppercase tracking-wider text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin
        </span>
        {(
          [
            { href: "/lite/admin/pipeline", label: "Pipeline", icon: LayoutGrid },
            { href: "/lite/calendar", label: "Calendar", icon: CalendarDays },
            { href: "/lite/admin/clients", label: "Clients", icon: Building2 },
            { href: "/lite/admin/lead-gen", label: "Lead Gen", icon: Radar },
            { href: "/lite/content", label: "Content", icon: Newspaper },
            { href: "/lite/admin/products", label: "Products", icon: Package },
            { href: "/lite/admin/settings/catalogue", label: "Catalogue", icon: Settings },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-sm py-1.5 pl-4 pr-3",
                "font-[family-name:var(--font-dm-sans)] text-[length:var(--text-small)]",
                "text-[color:var(--color-neutral-400)] outline-none",
                "transition-colors hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-neutral-100)]",
                "focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-cta)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--color-surface-1)]",
              )}
            >
              <Icon size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
