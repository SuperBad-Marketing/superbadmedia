"use client";

/**
 * PostHog analytics provider — session recording, heatmaps, pageview tracking.
 *
 * Loads only when:
 *   1. NEXT_PUBLIC_POSTHOG_KEY is set
 *   2. User has consented to "analytics" cookies (EU) or no consent decision
 *      is required yet (non-EU visitors get analytics by default until they
 *      opt out via the cookie banner)
 *
 * Reads consent from localStorage key `sb_cookie_consent` (same as
 * cookie-consent-banner.tsx). Re-checks on storage events so consent
 * changes take effect without a page reload.
 *
 * Owner: analytics setup.
 */

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
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

export function PostHogAnalyticsProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (!hasAnalyticsConsent()) return;

    if (!initialized) {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
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
  }, [initialized]);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogPageview />
      {children}
    </PHProvider>
  );
}
