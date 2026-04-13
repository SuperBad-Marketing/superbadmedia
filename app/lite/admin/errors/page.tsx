/**
 * /lite/admin/errors — support-ticket triage dashboard.
 *
 * Lists open support_tickets ordered by created_at_ms desc.
 * Admin-only. Redirects anonymous/non-admin visitors to the sign-in page.
 *
 * Owner: B1. Spec: BUILD_PLAN §B1.
 */
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { support_tickets } from "@/lib/db/schema/support-tickets";
import { EmptyState } from "@/components/lite/empty-state";

export const metadata: Metadata = {
  title: "SuperBad — Error Triage",
  robots: { index: false, follow: false },
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-AU", {
    timeZone: "Australia/Melbourne",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function ErrorsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  const tickets = await db
    .select()
    .from(support_tickets)
    .where(eq(support_tickets.status, "open"))
    .orderBy(desc(support_tickets.created_at_ms));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold">Error triage</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Open support tickets — {tickets.length} item{tickets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {tickets.length === 0 ? (
        <EmptyState hero="✓" message="No open tickets. All clear." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">
                      {ticket.surface}
                    </span>
                    <span>{formatDate(ticket.created_at_ms)}</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {ticket.page_url}
                  </p>
                  {ticket.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ticket.description}
                    </p>
                  )}
                  {ticket.sentry_issue_id && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Sentry:{" "}
                      <span className="font-mono">{ticket.sentry_issue_id}</span>
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  open
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
