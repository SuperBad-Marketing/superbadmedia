"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

export function StripeSyncButton() {
  const [syncing, setSyncing] = React.useState(false);
  const [result, setResult] = React.useState<{ synced: number } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/stripe-sync", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        router.refresh();
      }
    } finally {
      setSyncing(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 font-[family-name:var(--font-label)] text-[10px] uppercase text-[color:var(--color-neutral-400)] transition-colors duration-150 hover:text-[color:var(--color-brand-cream)] disabled:opacity-50"
      style={{ letterSpacing: "1.5px" }}
    >
      <RefreshCw
        className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
      />
      {syncing
        ? "Syncing..."
        : result
          ? `${result.synced} synced`
          : "Sync Stripe"}
    </button>
  );
}
