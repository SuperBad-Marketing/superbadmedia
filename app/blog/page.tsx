/**
 * Public blog index — `/blog`.
 *
 * Multi-tenant: resolves the owning company from the request hostname
 * via `companies.domain`. Falls back to the NEXT_PUBLIC_APP_URL host
 * for SuperBad's own blog at `superbadmedia.com.au/blog`.
 *
 * Owner: CE-3.
 */
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { resolveCompanyByDomain, listPublishedPosts } from "@/lib/content-engine/publish";

export const metadata: Metadata = {
  title: "Blog — SuperBad",
  description:
    "Thoughts on marketing, content, and making businesses interesting. No listicles. No fluff.",
  openGraph: {
    title: "Blog — SuperBad",
    description:
      "Thoughts on marketing, content, and making businesses interesting. No listicles. No fluff.",
    type: "website",
  },
};

async function resolveCompanyId(): Promise<string | null> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  const company = await resolveCompanyByDomain(host);
  if (company) return company.id;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appHost = appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (host.replace(/:\d+$/, "") === appHost.replace(/:\d+$/, "")) {
    const sbCompany = await resolveCompanyByDomain(appHost);
    return sbCompany?.id ?? null;
  }

  return null;
}

export default async function BlogIndexPage() {
  const companyId = await resolveCompanyId();
  const posts = companyId ? await listPublishedPosts(companyId) : [];

  return (
    <>
      {/* ── Fixed nav (mirrors homepage) ── */}
      <nav
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-8 py-3 sm:px-16 sm:py-4"
        style={{
          backgroundColor: "var(--neutral-900)",
          borderBottom: "1px solid rgba(253, 245, 230, 0.06)",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-logo)",
            fontSize: "clamp(20px, 2.5vw, 26px)",
            color: "var(--neutral-100)",
            textDecoration: "none",
          }}
        >
          SuperBad
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/trial-shoot"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              textDecoration: "none",
            }}
          >
            Trial Shoot
          </Link>
          <a
            href="mailto:andy@superbadmedia.com.au"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              textDecoration: "none",
            }}
          >
            Get in Touch
          </a>
        </div>
      </nav>

      <main
        className="mx-auto min-h-dvh max-w-3xl px-6 sm:px-8"
        style={{ paddingTop: "clamp(120px, 15vw, 180px)" }}
      >
        {/* ── Header ── */}
        <header className="mb-16">
          <p
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              marginBottom: "16px",
            }}
          >
            Blog
          </p>
          <h1
            className="text-balance"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 6vw, 64px)",
              lineHeight: 0.95,
              color: "var(--neutral-100)",
              margin: 0,
            }}
          >
            Thoughts on making businesses interesting
            <span style={{ color: "var(--brand-red)" }}>.</span>
          </h1>
          <p
            className="text-pretty"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-small)",
              color: "var(--neutral-400)",
              marginTop: "20px",
              maxWidth: "48ch",
            }}
          >
            No listicles. No &ldquo;10 tips to grow your business.&rdquo;
            Just honest observations about marketing, content, and what
            actually works.
          </p>
        </header>

        {/* ── Post list ── */}
        {posts.length === 0 ? (
          <div
            className="rounded-lg px-8 py-16 text-center"
            style={{
              backgroundColor: "var(--surface-1)",
              border: "1px solid rgba(253, 245, 230, 0.06)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 3vw, 32px)",
                lineHeight: 1,
                color: "var(--neutral-100)",
              }}
            >
              Nothing here yet
              <span style={{ color: "var(--brand-red)" }}>.</span>
            </p>
            <p
              className="text-pretty"
              style={{
                fontFamily: "var(--font-narrative)",
                fontStyle: "italic",
                fontSize: "14px",
                color: "var(--brand-pink)",
                marginTop: "12px",
              }}
            >
              the machine&apos;s warming up.
            </p>
          </div>
        ) : (
          <div
            className="flex flex-col"
            style={{
              borderTop: "1px solid rgba(253, 245, 230, 0.08)",
            }}
          >
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group block py-8 transition-colors"
                style={{
                  borderBottom: "1px solid rgba(253, 245, 230, 0.08)",
                  textDecoration: "none",
                }}
              >
                {post.published_at_ms && (
                  <time
                    dateTime={new Date(post.published_at_ms).toISOString()}
                    style={{
                      fontFamily: "var(--font-label)",
                      fontSize: "11px",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--neutral-500)",
                    }}
                  >
                    {new Date(post.published_at_ms).toLocaleDateString(
                      "en-AU",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  </time>
                )}
                <h2
                  className="text-balance mt-2 transition-colors group-hover:text-[color:var(--brand-pink)]"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(22px, 3vw, 32px)",
                    lineHeight: 1.1,
                    color: "var(--neutral-100)",
                    margin: 0,
                    marginTop: "6px",
                  }}
                >
                  {post.title}
                </h2>
                {post.meta_description && (
                  <p
                    className="text-pretty mt-3 line-clamp-2"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "15px",
                      lineHeight: 1.55,
                      color: "var(--neutral-400)",
                    }}
                  >
                    {post.meta_description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* ── Bottom breathing room ── */}
        <div style={{ height: "clamp(60px, 10vw, 120px)" }} />
      </main>
    </>
  );
}
