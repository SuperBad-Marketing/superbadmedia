/**
 * Public `/get-started/*` shell.
 *
 * Wraps every SaaS conversion surface (pricing, checkout in SB-5,
 * demo landing pages in SB-4) with the public header + footer.
 *
 * Public route tree — the proxy's gate matcher only fires on
 * `/lite/*` (see `proxy.ts` line 72), so `/get-started/*` bypasses
 * auth + Brand DNA + critical-flight gates without a proxy patch.
 *
 * No `CookieConsentBanner` on this shell yet — spec §12 surface,
 * lands in a post-launch patch alongside the marketing site per
 * `docs/specs/legal-pages.md`. Footer links to the legal pages.
 *
 * Owner: SB-3.
 */
import Link from "next/link";

import { FOOTER_COPY } from "@/lib/content/pricing-page";

export default function GetStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border border-b px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href={FOOTER_COPY.wordmarkHref}
            className="font-heading text-lg font-semibold tracking-tight transition-opacity hover:opacity-75"
          >
            {FOOTER_COPY.wordmark}
          </Link>
          <nav className="flex items-center gap-4 text-xs text-foreground/60">
            <Link
              href={FOOTER_COPY.privacyHref}
              className="hover:text-foreground transition-colors"
            >
              {FOOTER_COPY.privacyLabel}
            </Link>
            <Link
              href={FOOTER_COPY.termsHref}
              className="hover:text-foreground transition-colors"
            >
              {FOOTER_COPY.termsLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-border border-t px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-xs text-foreground/50 md:flex-row">
          <p>{FOOTER_COPY.gstFootnote}</p>
          <p>{FOOTER_COPY.copyrightTemplate(new Date().getFullYear())}</p>
        </div>
      </footer>
    </div>
  );
}
