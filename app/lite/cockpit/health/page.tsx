import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, AlertCircle } from "lucide-react";

import { auth } from "@/lib/auth/session";
import { mergeHealthBanners } from "@/lib/cockpit/aggregator";

export const metadata: Metadata = {
  title: "SuperBad — System Health",
  robots: { index: false, follow: false },
};

export default async function HealthPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/lite/login");
  }

  const banners = await mergeHealthBanners();

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
          System Health
        </h1>
        <p
          className="mt-2 text-[14px] font-[family-name:var(--font-serif)] italic"
          style={{ color: "var(--color-neutral-600)" }}
        >
          Active issues across the platform.
        </p>

        {banners.length === 0 ? (
          <p
            className="mt-8 text-[14px] font-[family-name:var(--font-serif)] italic"
            style={{ color: "var(--color-neutral-500)" }}
          >
            All systems healthy. Nothing to report.
          </p>
        ) : (
          <div className="mt-6 flex flex-col gap-2">
            {banners.map((b) => (
              <Link
                key={b.id}
                href={b.href}
                className="flex items-center gap-3 rounded-[var(--radius-default)] px-4 py-3 transition-colors"
                style={{
                  backgroundColor:
                    b.severity === "critical"
                      ? "var(--color-semantic-error-bg, rgba(178, 40, 72, 0.08))"
                      : "var(--color-semantic-warning-bg, rgba(242, 140, 82, 0.08))",
                }}
              >
                {b.severity === "critical" ? (
                  <AlertCircle
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: "var(--color-brand-red)" }}
                  />
                ) : (
                  <AlertTriangle
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: "var(--color-brand-orange)" }}
                  />
                )}
                <div className="flex-1">
                  <span
                    className="text-[14px] font-[family-name:var(--font-body)]"
                    style={{ color: "var(--color-neutral-800)" }}
                  >
                    {b.summary}
                  </span>
                </div>
                <span
                  className="text-[12px] font-[family-name:var(--font-label)]"
                  style={{ color: "var(--color-neutral-500)" }}
                >
                  {b.source.replace(/_/g, " ")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
