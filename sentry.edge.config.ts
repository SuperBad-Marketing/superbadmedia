/**
 * Sentry edge-runtime initialisation.
 * Loaded via instrumentation.ts register() for the edge runtime.
 *
 * Kill-switch not available in edge (no kill-switches import — edge must
 * stay free of Node-only deps). DSN env var is the control:
 * unset SENTRY_DSN to disable in edge runtime.
 *
 * Owner: B1.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  debug: false,
  tracesSampleRate: 1,
});
