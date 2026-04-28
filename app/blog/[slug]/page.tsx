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
import { NewsletterSignup } from "@/components/newsletter-signup";

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

        {(() => {
          const { first, second } = splitAtMidpoint(post.body);
          if (second) {
            return (
              <>
                <div className="blog-prose">
                  <MarkdownRenderer body={first} />
                </div>
                <NewsletterSignup variant="inline" source="blog_cta" />
                <div className="blog-prose">
                  <MarkdownRenderer body={second} />
                </div>
              </>
            );
          }
          return (
            <div className="blog-prose">
              <MarkdownRenderer body={first} />
            </div>
          );
        })()}

        <NewsletterSignup variant="end-of-post" source="blog_cta" />
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
  const blocks = md.split(/\n\n+/);
  const outputBlocks: string[] = [];

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i].trim();

    if (!block) { i++; continue; }

    // Code blocks
    if (block.startsWith("```")) {
      let codeBlock = block;
      while (!codeBlock.endsWith("```") || codeBlock === "```" || codeBlock.match(/```$/g)?.length === 1 && codeBlock.startsWith("```")) {
        if (codeBlock !== block || !codeBlock.slice(3).includes("```")) {
          i++;
          if (i < blocks.length) { codeBlock += "\n\n" + blocks[i]; } else { break; }
        } else { break; }
      }
      const match = codeBlock.match(/^```(\w*)\n([\s\S]*?)```$/);
      if (match) {
        outputBlocks.push(`<pre><code class="language-${match[1]}">${escapeHtml(match[2].trim())}</code></pre>`);
      } else {
        outputBlocks.push(`<pre><code>${escapeHtml(codeBlock.replace(/^```\w*\n?/, "").replace(/```$/, "").trim())}</code></pre>`);
      }
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(block)) {
      outputBlocks.push("<hr />");
      i++; continue;
    }

    // Table
    if (block.includes("|") && block.split("\n").length >= 2) {
      const lines = block.split("\n").filter((l) => l.trim());
      const isSepLine = (l: string) => /^\|?[\s-:|]+\|?$/.test(l.trim());
      if (lines.length >= 2 && isSepLine(lines[1])) {
        const parseRow = (l: string) =>
          l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => inlineMarkdown(c.trim()));
        const headerCells = parseRow(lines[0]);
        const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
        const bodyRows = lines.slice(2).map((l) => {
          const cells = parseRow(l);
          return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
        });
        outputBlocks.push(`<div class="blog-table-wrap"><table>${thead}<tbody>${bodyRows.join("")}</tbody></table></div>`);
        i++; continue;
      }
    }

    // Blockquote
    if (block.startsWith(">")) {
      const quoteLines = block.split("\n").map((l) => l.replace(/^>\s?/, ""));
      outputBlocks.push(`<blockquote><p>${inlineMarkdown(quoteLines.join(" "))}</p></blockquote>`);
      i++; continue;
    }

    // Headings
    if (block.startsWith("### ")) {
      outputBlocks.push(`<h3>${inlineMarkdown(block.slice(4))}</h3>`);
      i++; continue;
    }
    if (block.startsWith("## ")) {
      outputBlocks.push(`<h2>${inlineMarkdown(block.slice(3))}</h2>`);
      i++; continue;
    }
    if (block.startsWith("# ")) {
      outputBlocks.push(`<h1>${inlineMarkdown(block.slice(2))}</h1>`);
      i++; continue;
    }

    // Unordered list
    if (/^[-*] /.test(block)) {
      const items = block.split("\n")
        .filter((l) => /^[-*] /.test(l.trim()))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^[-*] /, ""))}</li>`);
      outputBlocks.push(`<ul>${items.join("")}</ul>`);
      i++; continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(block)) {
      const items = block.split("\n")
        .filter((l) => /^\d+\.\s/.test(l.trim()))
        .map((l) => `<li>${inlineMarkdown(l.replace(/^\d+\.\s/, ""))}</li>`);
      outputBlocks.push(`<ol>${items.join("")}</ol>`);
      i++; continue;
    }

    // Paragraph
    outputBlocks.push(`<p>${inlineMarkdown(block.replace(/\n/g, " "))}</p>`);
    i++;
  }

  return outputBlocks.join("\n");
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Split markdown at a paragraph boundary near the midpoint.
 * Returns the full body as `first` if the post is too short to split
 * (fewer than 6 paragraphs).
 */
function splitAtMidpoint(body: string): { first: string; second: string | null } {
  const paragraphs = body.split(/\n\n+/);
  if (paragraphs.length < 6) {
    return { first: body, second: null };
  }

  const targetIndex = Math.floor(paragraphs.length * 0.45);
  const splitIndex = Math.max(3, targetIndex);

  return {
    first: paragraphs.slice(0, splitIndex).join("\n\n"),
    second: paragraphs.slice(splitIndex).join("\n\n"),
  };
}
