/**
 * /lite/legal — index page listing all legal documents.
 *
 * Publicly accessible. No auth required.
 * Owner: B3.
 */
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal — SuperBad",
};

const LEGAL_DOCS = [
  {
    href: "/lite/legal/terms",
    title: "Terms of Service",
    description: "What governs your use of the SuperBad platform.",
  },
  {
    href: "/lite/legal/privacy",
    title: "Privacy Policy",
    description: "How we handle your personal information. APPs compliant.",
  },
  {
    href: "/lite/legal/acceptable-use",
    title: "Acceptable Use Policy",
    description: "What you can and can't do when using our platform.",
  },
  {
    href: "/lite/legal/cookie-policy",
    title: "Cookie Policy",
    description: "What cookies we use and how to manage them.",
  },
] as const;

export default function LegalIndexPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Legal</h1>
      <p className="text-sm text-foreground/60 mb-8">
        SuperBad Marketing ABN 00 000 000 000
      </p>
      <ul className="space-y-4">
        {LEGAL_DOCS.map((doc) => (
          <li key={doc.href}>
            <Link
              href={doc.href}
              className="block rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors group"
            >
              <p className="text-sm font-medium group-hover:text-primary transition-colors">
                {doc.title}
              </p>
              <p className="text-xs text-foreground/60 mt-0.5">
                {doc.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
