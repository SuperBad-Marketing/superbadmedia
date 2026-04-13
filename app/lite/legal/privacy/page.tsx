/**
 * /lite/legal/privacy — Privacy Policy.
 *
 * Static MDX page rendered via next-mdx-remote/rsc. Publicly accessible.
 * Logged-out visitors can view this page.
 * Owner: B3. Spec: docs/specs/legal-pages.md §1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";

export const metadata: Metadata = {
  title: "Privacy Policy — SuperBad",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  const source = readFileSync(
    join(process.cwd(), "content/legal/privacy.mdx"),
    "utf-8",
  );
  return <MDXRemote source={source} />;
}
