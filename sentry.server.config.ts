/**
 * Sentry server-side initialisation (Node.js runtime).
 * Loaded via instrumentation.ts register().
 *
 * Events are suppressed when `sentry_enabled` kill-switch is off (default).
 *
 * Owner: B1.
 */
import * as Sentry from "@sentry/nextjs";
import { killSwitches } from "@/lib/kill-switches";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  debug: false,
  tracesSampleRate: 1,
  beforeSend(event) {
    if (!killSwitches.sentry_enabled) return null;
    return event;
  },
});
