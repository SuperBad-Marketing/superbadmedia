import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { ContentTabs } from "../../_components/content-tabs";
import { ReplyQueueClient } from "./reply-queue-client";
import { getReplyQueue, getGraduationStatsAction } from "../reply-actions";

export const metadata: Metadata = {
  title: "SuperBad — Instagram Replies",
  robots: { index: false, follow: false },
};

export default async function InstagramRepliesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const [pendingResult, sentResult, escalatedResult, statsResult] =
    await Promise.all([
      getReplyQueue("pending", 50),
      getReplyQueue("sent", 30),
      getReplyQueue("escalated", 20),
      getGraduationStatsAction(),
    ]);

  return (
    <div className="min-h-screen bg-[color:var(--color-neutral-950)]">
      <div className="mx-auto max-w-[1200px] px-6">
        <header className="pt-6 pb-2">
          <div
            className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "2px" }}
          >
            Content{" "}
            <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
            <span className="text-[color:var(--color-brand-pink)]">
              Instagram
            </span>{" "}
            <span className="text-[color:var(--color-neutral-600)]">·</span>{" "}
            Replies
          </div>
          <h1
            className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.3px" }}
          >
            Reply Queue
          </h1>
          <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
            Review, edit, and approve AI-drafted replies.{" "}
            <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
              your voice, amplified.
            </em>
          </p>
        </header>

        <ContentTabs currentPath="/lite/content/instagram" />

        <ReplyQueueClient
          pending={pendingResult.ok ? pendingResult.value : []}
          sent={sentResult.ok ? sentResult.value : []}
          escalated={escalatedResult.ok ? escalatedResult.value : []}
          stats={statsResult.ok ? statsResult.value : null}
        />
      </div>
    </div>
  );
}
