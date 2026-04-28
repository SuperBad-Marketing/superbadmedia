import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { productions, productionChatMessages } from "@/lib/db/schema/productions";
import { ProductionsClient } from "./productions-client";

export const metadata: Metadata = {
  title: "SuperBad — Productions",
  robots: { index: false, follow: false },
};

export default async function ProductionsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const allProductions = await db
    .select()
    .from(productions)
    .orderBy(desc(productions.created_at_ms));

  const chatCountRows = await db
    .select({
      production_id: productionChatMessages.production_id,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(productionChatMessages)
    .groupBy(productionChatMessages.production_id);

  const chatCounts: Record<string, number> = {};
  for (const row of chatCountRows) {
    chatCounts[row.production_id] = row.count;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin{" "}
          <span className="text-[color:var(--color-neutral-600)]">&middot;</span>{" "}
          <span className="text-[color:var(--color-brand-pink)]">
            Productions
          </span>
        </div>
        <h1
          className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-none text-[color:var(--color-brand-cream)]"
          style={{ letterSpacing: "-0.3px" }}
        >
          Productions
        </h1>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Brainstorm, plan and track every episode.{" "}
          <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
            the ideas start here.
          </em>
        </p>
      </header>
      <ProductionsClient
        initialProductions={allProductions}
        chatCounts={chatCounts}
      />
    </div>
  );
}
