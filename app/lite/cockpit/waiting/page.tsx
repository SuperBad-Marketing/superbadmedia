import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { auth } from "@/lib/auth/session";
import { mergeWaitingItems } from "@/lib/cockpit/aggregator";

export const metadata: Metadata = {
  title: "SuperBad — Waiting on You",
  robots: { index: false, follow: false },
};

export default async function WaitingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const items = await mergeWaitingItems();

  return (
    <div className="min-h-full">
      <div className="max-w-[720px] mx-auto px-4 pt-6 pb-8">
        <nav className="mb-4">
          <Link
            href="/lite/cockpit"
            className="text-[13px] underline decoration-dotted underline-offset-2"
            style={{ color: "var(--color-neutral-500)" }}
          >
            &larr; Cockpit
          </Link>
        </nav>

        <h1
          className="font-[family-name:var(--font-display)] text-[32px] leading-none"
          style={{ color: "var(--color-neutral-950)" }}
        >
          Waiting on You
        </h1>
        <p
          className="mt-2 text-[14px] font-[family-name:var(--font-serif)] italic"
          style={{ color: "var(--color-neutral-600)" }}
        >
          Everything that needs your attention, sorted by urgency.
        </p>

        {items.length === 0 ? (
          <p
            className="mt-8 text-[14px] font-[family-name:var(--font-serif)] italic"
            style={{ color: "var(--color-neutral-500)" }}
          >
            Nothing waiting. The rail is clear.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between rounded-[var(--radius-default)] px-4 py-3 transition-colors"
                style={{
                  backgroundColor: "var(--color-surface-0)",
                  color: "var(--color-neutral-800)",
                }}
              >
                <span className="text-[14px] font-[family-name:var(--font-body)]">
                  {item.scope === "fleet" && (
                    <span
                      className="mr-2 text-[11px]"
                      style={{ color: "var(--color-neutral-500)" }}
                    >
                      [Fleet]
                    </span>
                  )}
                  {item.label}
                </span>
                <span
                  className="text-[12px] font-[family-name:var(--font-label)]"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {item.source.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
