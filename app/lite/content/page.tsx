/**
 * /lite/content — Content Engine admin landing (CE-3).
 *
 * Spec: docs/specs/content-engine.md §8.1.
 * Shows the Review tab: posts awaiting review. Company context is
 * resolved from ?company= search param via shared resolver.
 *
 * Admin-only.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { ContentTabs } from "./_components/content-tabs";
import { ContentGenerateButton } from "./_components/content-generate-button";
import { CompanyContextBar } from "./_components/company-context-bar";
import { resolveContentCompany } from "./_lib/resolve-company";

export const metadata: Metadata = {
  title: "Content Engine — SuperBad",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const sp = await searchParams;
  const { companies: contentCompanies, activeCompanyId } =
    await resolveContentCompany(sp);

  const { db } = await import("@/lib/db");
  const { blogPosts: blogPostsTable } = await import(
    "@/lib/db/schema/blog-posts"
  );
  const { desc, eq, and } = await import("drizzle-orm");

  const reviewPosts = activeCompanyId
    ? await db
        .select()
        .from(blogPostsTable)
        .where(
          and(
            eq(blogPostsTable.company_id, activeCompanyId),
            eq(blogPostsTable.status, "in_review"),
          ),
        )
        .orderBy(desc(blogPostsTable.created_at_ms))
    : [];

  const recentPublished = activeCompanyId
    ? await db
        .select()
        .from(blogPostsTable)
        .where(
          and(
            eq(blogPostsTable.company_id, activeCompanyId),
            eq(blogPostsTable.status, "published"),
          ),
        )
        .orderBy(desc(blogPostsTable.published_at_ms))
        .limit(10)
    : [];

  const totalPosts = reviewPosts.length + recentPublished.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {activeCompanyId && (
        <CompanyContextBar
          companies={contentCompanies}
          activeCompanyId={activeCompanyId}
        />
      )}
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Content Engine
          </h1>
          {activeCompanyId && (
            <ContentGenerateButton companyId={activeCompanyId} />
          )}
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          What&apos;s been written, what&apos;s waiting.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {reviewPosts.length > 0
              ? "some need your eyes."
              : "the queue\u2019s clear."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {totalPosts}
          </span>
          <span>post{totalPosts === 1 ? "" : "s"}</span>
          {reviewPosts.length > 0 && (
            <>
              <span aria-hidden className="text-[color:var(--color-neutral-700)]">·</span>
              <span
                className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-brand-orange)]"
                style={{ letterSpacing: "1.5px" }}
              >
                {reviewPosts.length} awaiting review
              </span>
            </>
          )}
        </div>
      </header>

      <ContentTabs currentPath="/lite/content" />

      {contentCompanies.length === 0 && (
        <div
          className="mb-8 rounded-[12px] px-8 py-8 text-center"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "var(--surface-highlight)",
            border: "1px solid rgba(244, 160, 176, 0.12)",
          }}
        >
          <p
            className="font-[family-name:var(--font-display)] text-[22px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.2px" }}
          >
            No content engine running yet.
          </p>
          <p className="mt-2 font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-400)]">
            Set up a company to start generating blog posts and newsletters.
          </p>
          <Link
            href="/lite/content/onboarding"
            className="mt-4 inline-block rounded-md px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--color-brand-pink)",
              color: "var(--color-neutral-950)",
              fontFamily: "var(--font-label)",
            }}
          >
            Run onboarding
          </Link>
        </div>
      )}

      {/* Posts awaiting review */}
      <section className="mb-12">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Awaiting Review
        </div>
        {reviewPosts.length === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <p
              className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.2px" }}
            >
              Nothing waiting.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              the machine&apos;s doing its thing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewPosts.map((post) => (
              <Link
                key={post.id}
                href={`/lite/content/review/${post.id}`}
                className="flex items-center justify-between rounded-[12px] p-5 transition-[transform,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-px hover:border-[color:rgba(244,160,176,0.22)]"
                style={{
                  background: "var(--color-surface-2)",
                  boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-[12px] italic text-[color:var(--color-brand-pink)]">
                    /{post.slug}
                    {" · "}
                    {new Date(post.created_at_ms).toLocaleDateString("en-AU")}
                  </p>
                </div>
                <span
                  className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
                  style={{
                    letterSpacing: "1.5px",
                    background: "rgba(242, 140, 82, 0.15)",
                    color: "var(--color-brand-orange)",
                  }}
                >
                  <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: "currentColor", opacity: 0.85 }} />
                  In Review
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recently published */}
      <section>
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Recently Published
        </div>
        {recentPublished.length === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <p
              className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]"
              style={{ letterSpacing: "-0.2px" }}
            >
              No published posts yet.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              patience is a publishing strategy.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentPublished.map((post) => (
              <div
                key={post.id}
                className="flex items-center justify-between rounded-[12px] p-5"
                style={{
                  background: "var(--color-surface-2)",
                  boxShadow: "var(--surface-highlight), 0 2px 8px rgba(0, 0, 0, 0.2)",
                  border: "1px solid rgba(253, 245, 230, 0.06)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[16px] font-medium text-[color:var(--color-brand-cream)]">
                    {post.title}
                  </h3>
                  <p className="mt-1 text-[12px] italic text-[color:var(--color-brand-pink)]">
                    {post.published_url ?? `/${post.slug}`}
                    {post.published_at_ms && (
                      <>
                        {" · "}
                        {new Date(post.published_at_ms).toLocaleDateString("en-AU")}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
                  style={{
                    letterSpacing: "1.5px",
                    background: "rgba(123, 174, 126, 0.14)",
                    color: "var(--color-success)",
                  }}
                >
                  <span aria-hidden className="h-1 w-1 rounded-full" style={{ background: "currentColor", opacity: 0.85 }} />
                  Published
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
