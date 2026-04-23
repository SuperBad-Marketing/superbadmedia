"use client";

import Link from "next/link";
import { AlertTriangle, AlertCircle } from "lucide-react";
import type { HealthBanner } from "@/lib/tasks/cockpit";

const MAX_VISIBLE = 2;

export function BannerStrip({ banners }: { banners: HealthBanner[] }) {
  if (banners.length === 0) return null;

  const visible = banners.slice(0, MAX_VISIBLE);
  const overflow = banners.length - MAX_VISIBLE;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((b) => (
        <Link
          key={b.id}
          href={b.href}
          className="flex items-center gap-3 rounded-[var(--radius-default)] px-4 py-3 transition-colors"
          style={{
            backgroundColor:
              b.severity === "critical"
                ? "var(--color-semantic-error-bg, rgba(178, 40, 72, 0.08))"
                : "var(--color-semantic-warning-bg, rgba(242, 140, 82, 0.08))",
            color:
              b.severity === "critical"
                ? "var(--color-brand-red)"
                : "var(--color-brand-orange)",
          }}
        >
          {b.severity === "critical" ? (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          <span
            className="text-[13px] font-[family-name:var(--font-body)]"
            style={{ color: "var(--color-neutral-300)" }}
          >
            {b.summary}
          </span>
        </Link>
      ))}
      {overflow > 0 && (
        <Link
          href="/lite/cockpit/health"
          className="text-[13px] underline decoration-dotted underline-offset-2 px-4"
          style={{ color: "var(--color-neutral-500)" }}
        >
          +{overflow} more issue{overflow === 1 ? "" : "s"}
        </Link>
      )}
    </div>
  );
}
