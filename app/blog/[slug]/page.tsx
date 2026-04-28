/**
 * Public blog post route — `/blog/[slug]`.
 *
 * Multi-tenant: resolves the owning company from the request hostname
 * via `companies.domain`. Falls back to the NEXT_PUBLIC_APP_URL host
 * for SuperBad's own blog at `superbadmedia.com.au/blog/*`.
 *
 * SEO package: title tag, meta description, OG image, JSON-LD Article
 * schema, canonical URL, table of contents (inline in markdown body).
 *
 * Owner: CE-3.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPost, resolveCompanyByDomain } from "@/lib/content-engine/publish";

interface BlogPageProps {
  params: Promise<{ slug: string }>;
}

/** Resolve the company ID from the request hostname. */
async function resolveCompanyId(): Promise<string | null> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "";

  // Try to match the hostname to a company
  const company = await resolveCompanyByDomain(host);
  if (company) return company.id;

  // Fallback: check if this is the main SuperBad domain
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appHost = appUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (host.replace(/:\d+$/, "") === appHost.replace(/:\d+$/, "")) {
    // SuperBad's own blog — find the SuperBad company
    const sbCompany = await resolveCompanyByDomain(appHost);
    return sbCompany?.id ?? null;
  }

  return null;
}

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const companyId = await resolveCompanyId();
  if (!companyId) return { title: "Not Found" };

  const post = await getPublishedPost(companyId, slug);
  if (!post) return { title: "Not Found" };

  const structuredData = post.structured_data as Record<string, unknown> | null;

  return {
    title: post.title,
    description: post.meta_description ?? undefined,
    openGraph: {
      title: post.title,
      description: post.meta_description ?? undefined,
      url: post.published_url ?? undefined,
      type: "article",
      ...(post.og_image_url ? { images: [{ url: post.og_image_url }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.meta_description ?? undefined,
      ...(post.og_image_url ? { images: [post.og_image_url] } : {}),
    },
    alternates: {
      canonical: post.published_url ?? undefined,
    },
    other: structuredData
      ? { "script:ld+json": JSON.stringify(structuredData) }
      : undefined,
  };
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const companyId = await resolveCompanyId();
  if (!companyId) notFound();

  const post = await getPublishedPost(companyId, slug);
  if (!post) notFound();

  const structuredData = post.structured_data as Record<string, unknown> | null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}

      {/* ── Fixed nav (mirrors blog index) ── */}
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
            href="/blog"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "var(--text-micro)",
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              textDecoration: "none",
            }}
          >
            Blog
          </Link>
          <Link
            href="/trial-shoot"
            className="hidden sm:inline"
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
        </div>
      </nav>

      <article
        className="mx-auto max-w-3xl px-6 sm:px-8"
        style={{ paddingTop: "clamp(120px, 15vw, 160px)" }}
      >
        <header className="mb-12">
          <Link
            href="/blog"
            style={{
              fontFamily: "var(--font-label)",
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--neutral-500)",
              textDecoration: "none",
            }}
          >
            &larr; All posts
          </Link>
          {post.published_at_ms && (
            <time
              dateTime={new Date(post.published_at_ms).toISOString()}
              className="mt-4 block"
              style={{
                fontFamily: "var(--font-label)",
                fontSize: "11px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--neutral-500)",
              }}
            >
              {new Date(post.published_at_ms).toLocaleDateString("en-AU", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
          <h1
            className="text-balance mt-3"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(32px, 5vw, 52px)",
              lineHeight: 1,
              color: "var(--neutral-100)",
              margin: 0,
              marginTop: "10px",
            }}
          >
            {post.title}
            <span style={{ color: "var(--brand-red)" }}>.</span>
          </h1>
        </header>

        <div className="blog-prose">
          <MarkdownRenderer body={post.body} />
        </div>

        {/* Newsletter opt-in — earned CTA at article end */}
        <aside
          className="mt-16 mb-20 rounded-lg px-8 py-8 text-center"
          style={{
            backgroundColor: "var(--surface-1)",
            border: "1px solid rgba(253, 245, 230, 0.06)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "14px",
              color: "var(--neutral-400)",
            }}
          >
            Want more like this? Subscribe to get new posts straight to your inbox.
          </p>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-narrative)",
              fontStyle: "italic",
              fontSize: "12px",
              color: "var(--brand-pink)",
            }}
          >
            no spam. unsubscribe anytime.
          </p>
        </aside>
      </article>
    </>
  );
}

/**
 * Simple markdown-to-HTML renderer. Handles headings, paragraphs, bold,
 * italic, links, lists, and code blocks. A proper remark/rehype pipeline
 * is a CE-5+ enhancement.
 */
function MarkdownRenderer({ body }: { body: string }) {
  const html = markdownToHtml(body);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function markdownToHtml(md: string): string {
  let html = md
    // Code blocks (must come before inline code)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, lang: string, code: string) =>
        `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`,
    )
    // Inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    // Horizontal rules
    .replace(/^---$/gm, "<hr />")
    // Paragraphs (blank-line separated)
    .replace(/\n\n/g, "</p><p>");

  // Wrap loose list items
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  // Clean up duplicate ul wrappers
  html = html.replace(/<\/ul>\s*<ul>/g, "");

  // Wrap in paragraph tags if not already
  if (!html.startsWith("<")) {
    html = `<p>${html}</p>`;
  }

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
