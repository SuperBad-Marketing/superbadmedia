/**
 * /lite/legal/terms — Terms of Service.
 *
 * Static MDX page rendered via next-mdx-remote/rsc. Publicly accessible.
 * Owner: B3. Spec: docs/specs/legal-pages.md §1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { MDXRemote } from "next-mdx-remote/rsc";

export const metadata: Metadata = {
  title: "Terms of Service — SuperBad",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  const source = readFileSync(
    join(process.cwd(), "content/legal/terms.mdx"),
    "utf-8",
  );
  return <MDXRemote source={source} />;
}
