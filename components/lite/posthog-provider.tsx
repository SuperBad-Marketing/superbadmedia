"use client";

/**
 * PostHog analytics provider — session recording, heatmaps, pageview tracking.
 *
 * Key resolution order:
 *   1. `posthogKey` prop (server-rendered from integration_connections)
 *   2. NEXT_PUBLIC_POSTHOG_KEY env var (build-time fallback)
 *
 * Loads only when a key is available AND the user has consented to
 * "analytics" cookies (EU) or no consent decision is required yet.
 *
 * Owner: analytics setup.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const ENV_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const ENV_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const CONSENT_STORAGE_KEY = "sb_cookie_consent";

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { accepted?: boolean; categories?: string[] };
    if (!parsed.accepted) return false;
    return parsed.categories?.includes("analytics") ?? false;
  } catch {
    return true;
  }
}

function PostHogPageview() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) {
        url += "?" + searchParams.toString();
      }
      posthog.capture("$pageview", { $current_url: url });
    }
  }, [pathname, searchParams]);

  return null;
}

export function PostHogAnalyticsProvider({
  children,
  posthogKey,
  posthogHost,
}: {
  children: React.ReactNode;
  posthogKey?: string | null;
  posthogHost?: string | null;
}) {
  const [initialized, setInitialized] = useState(false);
  const key = posthogKey || ENV_KEY;
  const host = posthogHost || ENV_HOST;

  useEffect(() => {
    if (!key) return;
    if (!hasAnalyticsConsent()) return;

    if (!initialized) {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: true,
        persistence: "localStorage+cookie",
      });
      setInitialized(true);
    }

    function onStorageChange(e: StorageEvent) {
      if (e.key !== CONSENT_STORAGE_KEY) return;
      if (!hasAnalyticsConsent()) {
        posthog.opt_out_capturing();
      } else {
        posthog.opt_in_capturing();
      }
    }
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, [initialized, key, host]);

  if (!key) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageview />
      {children}
    </PHProvider>
  );
}
