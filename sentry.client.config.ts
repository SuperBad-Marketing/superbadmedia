/**
 * Sentry client-side initialisation.
 * Injected into the browser bundle by the Sentry webpack plugin.
 *
 * Events are suppressed when `sentry_enabled` kill-switch is off (default).
 * Disable by setting NEXT_PUBLIC_SENTRY_DSN="" in Coolify.
 *
 * Owner: B1.
 */
import * as Sentry from "@sentry/nextjs";
import { killSwitches } from "@/lib/kill-switches";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  debug: false,
  tracesSampleRate: 1,
  beforeSend(event) {
    if (!killSwitches.sentry_enabled) return null;
    return event;
  },
});
