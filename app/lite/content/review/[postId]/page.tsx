/**
 * /lite/content/review/[postId] — split-pane blog review (CE-3).
 *
 * Spec: docs/specs/content-engine.md §2.1 Stage 4.
 * Admin-only. Renders the split-pane review surface with
 * rendered preview left, rejection chat right.
 */
import { redirect, notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import {
  getBlogPostForReview,
  getBlogPostFeedback,
} from "@/lib/content-engine/review";
import { ReviewSplitPane } from "../../_components/review-split-pane";

interface ReviewPageProps {
  params: Promise<{ postId: string }>;
}

export async function generateMetadata({
  params,
}: ReviewPageProps): Promise<Metadata> {
  const { postId } = await params;
  const data = await getBlogPostForReview(postId);
  return {
    title: data
      ? `Review: ${data.post.title} — Content Engine`
      : "Review — Content Engine",
  };
}

export default async function ReviewPage({ params }: ReviewPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const { postId } = await params;
  const data = await getBlogPostForReview(postId);
  if (!data) notFound();

  const feedback = await getBlogPostFeedback(postId);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Content · Review
          </div>
          <h1
            className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            {data.post.title}
          </h1>
        </div>
        <a
          href="/lite/content"
          className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)] transition-colors duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "1.5px" }}
        >
          Back to queue
        </a>
      </div>
      <div className="flex-1 min-h-0">
        <ReviewSplitPane
          post={data.post}
          topic={data.topic ? { keyword: data.topic.keyword } : null}
          feedback={feedback}
        />
      </div>
    </div>
  );
}
