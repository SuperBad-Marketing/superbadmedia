import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Paintbrush, ShoppingBag, FileText, Plug, Mic, Trash2, Volume2 } from "lucide-react";

import { auth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "SuperBad — Settings",
  robots: { index: false, follow: false },
};

const SECTIONS = [
  {
    href: "/lite/admin/settings/display",
    icon: Paintbrush,
    label: "Display",
    description: "Theme, sounds, motion, density, typeface, text size.",
  },
  {
    href: "/lite/admin/settings/brand-voice",
    icon: Mic,
    label: "Brand Voice",
    description: "Voice examples, Brand DNA, how the AI sounds.",
  },
  {
    href: "/lite/admin/settings/integrations",
    icon: Plug,
    label: "Integrations",
    description: "API keys, webhooks, third-party connections.",
  },
  {
    href: "/lite/admin/settings/sfx",
    icon: Volume2,
    label: "SFX Library",
    description: "Sound effects for motion posts. Upload your own or use the defaults.",
  },
  {
    href: "/lite/admin/settings/catalogue",
    icon: ShoppingBag,
    label: "Catalogue",
    description: "Priced deliverables the Quote Builder can reach for.",
  },
  {
    href: "/lite/admin/settings/quote-templates",
    icon: FileText,
    label: "Quote Templates",
    description: "Saved templates for recurring quote structures.",
  },
  {
    href: "/lite/admin/settings/data-management",
    icon: Trash2,
    label: "Data Management",
    description: "Reset Brand DNA, clear client context, start fresh.",
  },
] as const;

export default async function SettingsIndexPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">Settings</span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Settings
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Platform configuration.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the knobs behind the curtain.
          </em>
        </p>
      </header>

      <div className="grid gap-3 px-4 pb-8 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-start gap-3 rounded-xl border border-[color:var(--color-neutral-700)] bg-[color:var(--color-neutral-900)] px-4 py-4 transition-colors hover:border-[color:var(--color-brand-pink)]"
          >
            <s.icon
              className="mt-0.5 size-5 shrink-0 text-[color:var(--color-neutral-500)] transition-colors group-hover:text-[color:var(--color-brand-pink)]"
              strokeWidth={1.5}
            />
            <div>
              <span className="font-[family-name:var(--font-label)] text-[12px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]">
                {s.label}
              </span>
              <p className="mt-1 font-[family-name:var(--font-body)] text-[13px] leading-[1.5] text-[color:var(--color-neutral-400)]">
                {s.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
