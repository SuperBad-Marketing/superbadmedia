/**
 * /lite/content/topics — Topic queue + seed keyword management (CE-10).
 *
 * Spec: docs/specs/content-engine.md §2.1 Stage 2, §8.1.
 * Shows passive topic queue with outlines, veto power, and seed
 * keyword management for the research pipeline.
 *
 * Admin-only.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { contentEngineConfig } from "@/lib/db/schema/content-engine-config";
import { listQueuedTopics } from "@/lib/content-engine/topic-queue";
import { ContentTabs } from "../_components/content-tabs";
import { TopicQueueList } from "../_components/topic-queue-list";
import { SeedKeywordManager } from "../_components/seed-keyword-manager";
import { RunResearchButton } from "../_components/run-research-button";

export const metadata: Metadata = {
  title: "Topics — SuperBad",
};

export default async function TopicsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // For now, get the first company config (admin view).
  // Multi-company filter will come with subscriber fleet overview.
  const config = await db
    .select({
      company_id: contentEngineConfig.company_id,
      seed_keywords: contentEngineConfig.seed_keywords,
    })
    .from(contentEngineConfig)
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const companyId = config?.company_id ?? null;
  const seedKeywords = (config?.seed_keywords as string[] | null) ?? [];

  const topics = companyId ? await listQueuedTopics(companyId) : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Content · Topics
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.4px" }}
        >
          Topics
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Seeds in, topics out.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            {topics.length > 0 ? "the pipeline\u2019s producing." : "feed it keywords and wait."}
          </em>
        </p>
        <div className="mt-4 flex items-center gap-4 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {topics.length}
          </span>
          <span>queued topic{topics.length === 1 ? "" : "s"}</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">·</span>
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {seedKeywords.length}
          </span>
          <span>seed keyword{seedKeywords.length === 1 ? "" : "s"}</span>
        </div>
      </header>

      <ContentTabs currentPath="/lite/content/topics" />

      {/* Seed keywords */}
      <section className="mb-10">
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-brand-orange)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Seed Keywords
        </div>
        <p className="mb-4 text-[14px] text-[color:var(--color-neutral-300)]">
          Seed keywords feed the weekly research pipeline. Add keywords relevant to your business — the engine finds rankable topics from them.
        </p>
        {companyId ? (
          <div className="space-y-5">
            <SeedKeywordManager
              companyId={companyId}
              initialKeywords={seedKeywords}
            />
            {seedKeywords.length > 0 && (
              <RunResearchButton companyId={companyId} />
            )}
          </div>
        ) : (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
              No content engine configured yet.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              run onboarding first.
            </p>
          </div>
        )}
      </section>

      {/* Topic queue */}
      <section>
        <div
          className="mb-4 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2.5px" }}
        >
          Topic Queue
        </div>
        {topics.length === 0 ? (
          <div
            className="rounded-[12px] px-8 py-10 text-center"
            style={{ background: "var(--color-surface-2)", boxShadow: "var(--surface-highlight)" }}
          >
            <p className="font-[family-name:var(--font-display)] text-[26px] leading-none text-[color:var(--color-brand-cream)]" style={{ letterSpacing: "-0.2px" }}>
              Queue&apos;s empty.
            </p>
            <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
              run keyword research to fill it.
            </p>
          </div>
        ) : (
          <TopicQueueList topics={topics} />
        )}
      </section>
    </div>
  );
}
