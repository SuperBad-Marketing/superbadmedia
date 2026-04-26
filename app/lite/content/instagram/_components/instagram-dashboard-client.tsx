"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { retryInstagramDiscoveryAction } from "../actions";

interface AccountSummary {
  id: string;
  username: string;
  account_type: string;
  status: string;
}

interface Props {
  accounts: AccountSummary[];
  metaConnected: boolean;
}

export function InstagramDashboardClient({ accounts, metaConnected }: Props) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    const result = await retryInstagramDiscoveryAction();
    setRetrying(false);
    if (result.ok) {
      router.refresh();
    } else {
      setRetryError(result.error);
    }
  }

  if (accounts.length === 0) {
    if (metaConnected) {
      return (
        <div className="py-20 text-center">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          >
            <span className="font-[family-name:var(--font-display)] text-[24px] text-[color:var(--color-neutral-600)]">
              IG
            </span>
          </div>
          <h2 className="font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-brand-cream)]">
            Meta connected — Instagram not found
          </h2>
          <p className="mt-2 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
            Your Meta account is connected but no Instagram Business Account was
            detected. Make sure your Instagram is linked to a Facebook Page in
            Meta Business Suite, then retry.
          </p>
          {retryError && (
            <p className="mt-3 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-brand-red)]">
              {retryError}
            </p>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-6 inline-block rounded-lg px-5 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)] disabled:opacity-50"
            style={{ backgroundColor: "var(--color-brand-red)" }}
          >
            {retrying ? "Checking…" : "Retry Connection"}
          </button>
        </div>
      );
    }

    return (
      <div className="py-20 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--color-neutral-800)" }}
        >
          <span className="font-[family-name:var(--font-display)] text-[24px] text-[color:var(--color-neutral-600)]">
            IG
          </span>
        </div>
        <h2 className="font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-brand-cream)]">
          No Instagram account connected
        </h2>
        <p className="mt-2 max-w-[400px] mx-auto font-[family-name:var(--font-body)] text-[14px] text-[color:var(--color-neutral-500)]">
          Connect your Meta account in Settings → Integrations to start
          publishing and tracking metrics.
        </p>
        <Link
          href="/lite/admin/settings/integrations"
          className="mt-6 inline-block rounded-lg px-5 py-2.5 font-[family-name:var(--font-label)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--color-brand-cream)]"
          style={{
            backgroundColor: "var(--color-brand-red)",
          }}
        >
          Connect Meta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Account header */}
      <div
        className="flex items-center justify-between rounded-xl border px-5 py-4"
        style={{
          backgroundColor: "var(--color-neutral-900)",
          borderColor: "rgba(253, 245, 230, 0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[14px] text-[color:var(--color-brand-cream)]"
            style={{ backgroundColor: "var(--color-neutral-800)" }}
          >
            IG
          </div>
          <div>
            <div className="font-[family-name:var(--font-body)] text-[15px] text-[color:var(--color-brand-cream)]">
              @{accounts[0].username}
            </div>
            <div className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
              {accounts[0].account_type === "own"
                ? "SuperBad"
                : "Client account"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--color-brand-pink)" }}
          />
          <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
            Connected
          </span>
        </div>
      </div>

      {/* Placeholder sections — will be populated in subsequent sessions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DashboardCard title="Followers" subtitle="Growth over time">
          <PlaceholderChart />
        </DashboardCard>
        <DashboardCard title="Engagement" subtitle="Saves, shares, comments">
          <PlaceholderChart />
        </DashboardCard>
        <DashboardCard title="Reach" subtitle="Accounts reached">
          <PlaceholderChart />
        </DashboardCard>
      </div>

      <DashboardCard title="Recent Posts" subtitle="Performance by post">
        <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
          Metrics sync will populate this once the scheduled task runs.
        </div>
      </DashboardCard>

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardCard title="Strategy" subtitle="Weekly AI recommendations">
          <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            First digest generates after one week of data.
          </div>
        </DashboardCard>
        <DashboardCard title="Audience" subtitle="Demographics and activity">
          <div className="py-8 text-center font-[family-name:var(--font-body)] text-[13px] text-[color:var(--color-neutral-500)]">
            Available after 100+ followers.
          </div>
        </DashboardCard>
      </div>
    </div>
  );
}

function DashboardCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--color-neutral-900)",
        borderColor: "rgba(253, 245, 230, 0.06)",
      }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-[family-name:var(--font-body)] text-[14px] font-medium text-[color:var(--color-brand-cream)]">
          {title}
        </h3>
        <span className="font-[family-name:var(--font-label)] text-[9px] uppercase tracking-[1.5px] text-[color:var(--color-neutral-500)]">
          {subtitle}
        </span>
      </div>
      {children}
    </div>
  );
}

function PlaceholderChart() {
  return (
    <div
      className="flex h-[120px] items-center justify-center rounded-lg"
      style={{ backgroundColor: "var(--color-neutral-800)" }}
    >
      <span className="font-[family-name:var(--font-body)] text-[12px] text-[color:var(--color-neutral-600)]">
        Awaiting data
      </span>
    </div>
  );
}
