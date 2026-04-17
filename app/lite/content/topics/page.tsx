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
      <ContentTabs currentPath="/lite/content/topics" />

      {/* Seed keywords */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Seed Keywords</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Seed keywords feed the weekly research pipeline. Add keywords
          relevant to your business — the engine finds rankable topics
          from them.
        </p>
        {companyId ? (
          <SeedKeywordManager
            companyId={companyId}
            initialKeywords={seedKeywords}
          />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No content engine configured yet.
          </p>
        )}
      </section>

      {/* Topic queue */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Topic Queue</h2>
        {topics.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No topics queued. Run keyword research to populate the queue.
          </p>
        ) : (
          <TopicQueueList topics={topics} />
        )}
      </section>
    </div>
  );
}
