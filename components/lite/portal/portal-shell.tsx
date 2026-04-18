"use client";

import { usePathname } from "next/navigation";
import { MenuBubble } from "./menu-bubble";
import { ChatBubble } from "./chat-bubble";
import type { PortalMode } from "@/lib/portal/mode";

interface MenuSection {
  key: string;
  label: string;
  eyebrow: string;
  description: string;
  preRetainer: boolean;
}

interface PortalShellProps {
  portalToken: string;
  portalMode: PortalMode;
  contactName: string;
  sections: MenuSection[];
  children: React.ReactNode;
}

export function PortalShell({
  portalToken,
  portalMode,
  contactName,
  sections,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const isChat = pathname === `/lite/portal/${portalToken}`;
  const currentSection = isChat
    ? "chat"
    : pathname.split("/").pop() ?? "chat";

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--color-surface-0)]">
      {/* Ambient background gradients */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(242, 140, 82, 0.10), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(178, 40, 72, 0.08), transparent 60%)",
            "radial-gradient(ellipse 60% 60% at 0% 80%, rgba(244, 160, 176, 0.05), transparent 60%)",
          ].join(", "),
        }}
      />

      {/* Noise overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Top bar */}
      <header className="relative z-[2] flex flex-shrink-0 items-center justify-between border-b border-[rgba(253,245,230,0.04)] px-8 py-5">
        <span className="cursor-pointer font-[family-name:var(--font-pacifico)] text-[22px] text-[var(--color-brand-cream)]">
          SuperBad
        </span>
        <span className="font-[family-name:var(--font-righteous)] text-[10px] uppercase tracking-[2px] text-[var(--color-neutral-500)]">
          <em className="not-italic text-[var(--color-brand-pink)]">
            {contactName.split(" ")[0]}
          </em>
          &apos;s room
        </span>
      </header>

      {/* Main content */}
      <main className="relative z-[2] flex-1">{children}</main>

      {/* Menu bubble — always visible */}
      <MenuBubble
        portalToken={portalToken}
        portalMode={portalMode}
        sections={sections}
        currentSection={currentSection}
      />

      {/* Chat bubble — visible on non-chat pages */}
      {!isChat && <ChatBubble portalToken={portalToken} />}
    </div>
  );
}
