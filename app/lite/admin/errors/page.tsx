/**
 * /lite/admin/errors — support-ticket triage dashboard.
 *
 * Lists open support_tickets + resolved within a rolling window for context.
 * Admin-only. Redirects anonymous/non-admin visitors to the sign-in page.
 *
 * Visual rebuild: sessions/admin-polish-3-brief.md against mockup-admin-interior.html.
 * Owner: B1.
 */
import { redirect } from "next/navigation";
import { desc, gte, or, eq } from "drizzle-orm";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { support_tickets } from "@/lib/db/schema/support-tickets";

export const metadata: Metadata = {
  title: "SuperBad — Error Triage",
  robots: { index: false, follow: false },
};

const RESOLVED_WINDOW_DAYS = 30;
const RESOLVED_WINDOW_MS = RESOLVED_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function formatWhen(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "Australia/Melbourne",
  });
}

type TicketStatus = "open" | "resolved";

function StatusChip({ status }: { status: TicketStatus }) {
  const tone =
    status === "open"
      ? {
          bg: "rgba(178, 40, 72, 0.18)",
          color: "var(--color-brand-orange)",
        }
      : {
          bg: "rgba(123, 174, 126, 0.14)",
          color: "var(--color-success)",
        };
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] font-[family-name:var(--font-label)] text-[10px] uppercase leading-none"
      style={{
        letterSpacing: "1.5px",
        background: tone.bg,
        color: tone.color,
      }}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: "currentColor", opacity: 0.85 }}
      />
      {status === "open" ? "Open" : "Resolved"}
    </span>
  );
}

export default async function ErrorsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "admin") {
    redirect("/api/auth/signin");
  }

  // eslint-disable-next-line react-hooks/purity -- server component, runs once
  const windowStartMs = Date.now() - RESOLVED_WINDOW_MS;
  const tickets = await db
    .select()
    .from(support_tickets)
    .where(
      or(
        eq(support_tickets.status, "open"),
        gte(support_tickets.created_at_ms, windowStartMs),
      ),
    )
    .orderBy(desc(support_tickets.created_at_ms));

  const openTickets = tickets.filter((t) => t.status === "open");
  const openCount = openTickets.length;
  const resolvedCount = tickets.length - openCount;
  const isEmpty = tickets.length === 0;

  return (
    <div>
      <header className="px-4 pt-6 pb-5">
        <div
          className="font-[family-name:var(--font-label)] text-[10px] uppercase leading-none text-[color:var(--color-neutral-500)]"
          style={{ letterSpacing: "2px" }}
        >
          Admin · Errors
        </div>
        <div className="mt-3">
          <h1
            className="font-[family-name:var(--font-display)] text-[40px] leading-none text-[color:var(--color-brand-cream)]"
            style={{ letterSpacing: "-0.4px" }}
          >
            Error triage
          </h1>
        </div>
        <p className="mt-3 max-w-[640px] font-[family-name:var(--font-body)] text-[16px] leading-[1.55] text-[color:var(--color-neutral-300)]">
          Surfaces that asked for help.
          {isEmpty ? null : (
            <>
              {" "}
              <em className="font-[family-name:var(--font-narrative)] text-[color:var(--color-brand-pink)]">
                {openCount > 0 ? "something's on fire." : "quiet night."}
              </em>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-500)]">
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-300)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {openCount}
          </span>
          <span>open</span>
          <span aria-hidden className="text-[color:var(--color-neutral-700)]">
            ·
          </span>
          <span
            className="font-[family-name:var(--font-label)] uppercase text-[color:var(--color-neutral-500)]"
            style={{ letterSpacing: "1.5px" }}
          >
            {resolvedCount}
          </span>
          <span>resolved · {RESOLVED_WINDOW_DAYS}d</span>
        </div>
      </header>

      {openCount > 0 ? (
        <section aria-label="Open fatal alert" className="px-4 pb-4">
          <div
            role="status"
            className="flex flex-col gap-1 rounded-[10px] px-4 py-[14px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(178,40,72,0.12), rgba(242,140,82,0.06))",
              border: "1px solid rgba(178, 40, 72, 0.25)",
            }}
          >
            <div
              className="font-[family-name:var(--font-label)] uppercase text-[10px] text-[color:var(--color-brand-orange)]"
              style={{ letterSpacing: "1.5px" }}
            >
              Open · attention
            </div>
            <div className="text-[14px] text-[color:var(--color-neutral-300)]">
              {openCount} ticket{openCount === 1 ? "" : "s"} waiting — triage
              oldest first.
            </div>
            <div className="text-[12px] italic text-[color:var(--color-brand-pink)]">
              sentry replay + page url surfaced inline; no click-through needed
              to read the scene.
            </div>
          </div>
        </section>
      ) : null}

      <section aria-label="Ticket list" className="px-4 pb-10">
        {isEmpty ? (
          <EmptyErrors />
        ) : (
          <div
            className="overflow-hidden rounded-[12px]"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "var(--surface-highlight)",
            }}
          >
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    { label: "Surface", w: "20%" },
                    { label: "Where", w: "auto" },
                    { label: "When", w: "14%" },
                    { label: "Status", w: "12%" },
                  ].map((h) => (
                    <th
                      key={h.label}
                      className="font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-500)]"
                      style={{
                        letterSpacing: "2px",
                        padding: "12px 14px",
                        borderBottom: "1px solid rgba(253, 245, 230, 0.05)",
                        width: h.w,
                      }}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  const dimmed = t.status === "resolved";
                  return (
                    <tr
                      key={t.id}
                      className="transition-colors duration-[160ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[rgba(253,245,230,0.025)]"
                    >
                      <td
                        className="font-[family-name:var(--font-label)] text-[11px] uppercase tabular-nums"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          letterSpacing: "1px",
                          color: dimmed
                            ? "var(--color-neutral-500)"
                            : "var(--color-brand-cream)",
                        }}
                      >
                        {t.surface}
                      </td>
                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: dimmed
                            ? "var(--color-neutral-500)"
                            : "var(--color-neutral-300)",
                        }}
                      >
                        <div
                          className="font-[family-name:var(--font-body)] text-[13px] truncate"
                          style={{ maxWidth: "52ch" }}
                        >
                          {t.page_url}
                        </div>
                        {t.description ? (
                          <div
                            className="mt-1 font-[family-name:var(--font-body)] text-[12px] italic"
                            style={{
                              color: dimmed
                                ? "var(--color-neutral-500)"
                                : "var(--color-neutral-500)",
                            }}
                          >
                            {t.description}
                          </div>
                        ) : null}
                        {t.sentry_issue_id ? (
                          <div
                            className="mt-1 font-[family-name:var(--font-label)] text-[10px] uppercase tabular-nums"
                            style={{
                              letterSpacing: "1.5px",
                              color: "var(--color-neutral-500)",
                            }}
                          >
                            Sentry · {t.sentry_issue_id}
                          </div>
                        ) : null}
                      </td>
                      <td
                        className="font-[family-name:var(--font-body)] text-[12px] italic"
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                          color: "var(--color-neutral-500)",
                        }}
                      >
                        {formatWhen(t.created_at_ms)}
                      </td>
                      <td
                        style={{
                          padding: "14px",
                          borderBottom: "1px solid rgba(253, 245, 230, 0.03)",
                        }}
                      >
                        <StatusChip status={t.status as TicketStatus} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyErrors() {
  return (
    <div
      className="rounded-[12px] px-8 py-10 text-center"
      style={{
        background: "var(--color-surface-2)",
        boxShadow: "var(--surface-highlight)",
      }}
    >
      <p
        className="font-[family-name:var(--font-display)] text-[28px] leading-none text-[color:var(--color-brand-cream)]"
        style={{ letterSpacing: "-0.2px" }}
      >
        No errors. Impressive.
      </p>
      <p className="mt-3 font-[family-name:var(--font-narrative)] text-[14px] italic text-[color:var(--color-brand-pink)]">
        or the logger&apos;s asleep. either way.
      </p>
    </div>
  );
}
