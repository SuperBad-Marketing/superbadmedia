/**
 * Legal pages layout — /lite/legal/*.
 *
 * Publicly accessible (no auth gate). Excluded from admin/Brand DNA gates
 * via `isPublicRoute()` in proxy.ts.
 *
 * Responsibilities:
 *   - Reads client IP from `x-forwarded-for` header (server-side).
 *   - Calls `isEuIp()` to determine if visitor is in the EU/UK.
 *   - Renders `CookieConsentBanner` with the `isEu` prop:
 *     - EU: full reject/accept/manage banner.
 *     - Non-EU: permanent footer link to /lite/legal/cookie-policy.
 *   - Applies clean legal-page chrome (no admin sidebar).
 *   - Prose styling via Tailwind arbitrary-selector syntax — wraps all MDX
 *     HTML output (h1/h2/h3/p/ul/ol/li/table/a/hr/blockquote/code/strong).
 *
 * Owner: B3. Spec: docs/specs/legal-pages.md.
 */
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";

import { isEuIp, getClientIp } from "@/lib/geo/maxmind";
import { CookieConsentBanner } from "@/components/lite/cookie-consent-banner";

export const metadata: Metadata = {
  title: "Legal — SuperBad",
  robots: { index: true, follow: true },
};

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const ip = getClientIp(headersList.get("x-forwarded-for"));
  const isEu = await isEuIp(ip);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight hover:opacity-75 transition-opacity"
          >
            SuperBad
          </Link>
          <Link
            href="/lite/legal"
            className="text-xs text-foreground/60 hover:text-foreground transition-colors"
          >
            Legal
          </Link>
        </div>
      </header>

      {/* Content — prose styling via Tailwind arbitrary selectors */}
      <main className="flex-1 px-6 py-10">
        <div
          className={[
            "mx-auto max-w-3xl",
            // Headings
            "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h1]:mt-0",
            "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-4 [&_h2]:mt-8",
            "[&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2",
            "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-3 [&_h3]:mt-6",
            // Body text
            "[&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-foreground/90",
            // Links
            "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
            "[&_a:hover]:text-primary/80",
            // Lists
            "[&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-4 [&_ul]:space-y-1",
            "[&_ul]:text-sm [&_ul]:text-foreground/90",
            "[&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-4 [&_ol]:space-y-1",
            "[&_ol]:text-sm [&_ol]:text-foreground/90",
            "[&_li]:leading-relaxed",
            // Tables
            "[&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mb-6",
            "[&_thead]:border-b [&_thead]:border-border",
            "[&_th]:text-left [&_th]:py-2 [&_th]:pr-4 [&_th]:font-medium",
            "[&_th]:text-foreground/70 [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide",
            "[&_td]:py-2 [&_td]:pr-4 [&_td]:border-b [&_td]:border-border/50",
            "[&_td]:text-sm",
            // Divider
            "[&_hr]:my-8 [&_hr]:border-border",
            // Blockquote
            "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30",
            "[&_blockquote]:pl-4 [&_blockquote]:my-4",
            "[&_blockquote]:text-foreground/70 [&_blockquote]:italic [&_blockquote]:text-sm",
            // Code
            "[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5",
            "[&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
            // Strong
            "[&_strong]:font-semibold [&_strong]:text-foreground",
          ].join(" ")}
        >
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <CookieConsentBanner isEu={isEu} />
          <p className="text-xs text-foreground/40 text-center mt-2">
            © {new Date().getFullYear()} SuperBad Marketing. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
