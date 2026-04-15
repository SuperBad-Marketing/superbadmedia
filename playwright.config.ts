/**
 * Playwright E2E configuration — SW-5c.
 *
 * Runs a single Chromium project against `npm run dev` on port 3001 with
 * a hermetic sqlite DB (`tests/e2e/.test-critical-flight.db`) and a
 * deterministic NEXTAUTH_SECRET so the globalSetup can encode a pre-signed
 * session cookie that the dev server will decode as authenticated.
 *
 * Rollback per brief §8: devDep + feature-flag-gated (setup_wizards_enabled
 * enabled via KILL_SWITCHES_ON env only for this webServer — prod defaults
 * unchanged).
 *
 * Owner: SW-5c.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Hermetic DB lives outside the project directory because Andy's Desktop
// is iCloud-synced — iCloud Drive intercepts sqlite writes inside the
// project and silently drops them, producing "FILE 2.db" duplicates.
const DB_FILE = path.join(os.tmpdir(), "sblite-e2e", ".test-critical-flight.db");
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

// Deterministic per-run secrets. Safe: never read outside the webServer
// subprocess and the globalSetup that seeds it.
const NEXTAUTH_SECRET =
  "e2e-nextauth-secret-do-not-use-outside-playwright-runs";
const STRIPE_WEBHOOK_SECRET = "whsec_e2e_playwright";
// 32-byte hex key (AES-256-GCM). Test-only, regenerated per session.
const CREDENTIAL_VAULT_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  globalSetup: require.resolve("./tests/e2e/fixtures/seed-db.ts"),

  use: {
    baseURL: BASE_URL,
    storageState: path.join("tests", "e2e", ".auth-state.json"),
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { browserName: "chromium" } }],

  webServer: {
    // Uses `next build && next start` instead of `next dev` because Next 16
    // Turbopack's dev server silently drops better-sqlite3 writes from RSC
    // (see qbe2e_dev_server_write_persistence in PATCHES_OWED.md). `next
    // start` against a production build persists writes normally.
    command: `next build && next start -p ${PORT}`,
    url: `${BASE_URL}/api/auth/session`,
    reuseExistingServer: false,
    timeout: 360_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: `file:${DB_FILE}`,
      DB_FILE_PATH: DB_FILE,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      NEXTAUTH_URL: BASE_URL,
      NEXTAUTH_SECRET,
      AUTH_TRUST_HOST: "true",
      STRIPE_WEBHOOK_SECRET,
      STRIPE_SECRET_KEY: process.env.STRIPE_TEST_KEY ?? "",
      STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      // Placeholder satisfies Resend SDK's constructor-time format check.
      // Actual sends are blocked by `EMAIL_FROM`'s domain + the `sendEmail`
      // skip-path which returns `{skipped:true}` in non-production when the
      // email gate isn't opened.
      RESEND_API_KEY: "re_test_placeholder",
      EMAIL_FROM: "andy@superbadmedia.com.au",
      EMAIL_FROM_NAME: "Andy Robinson — SuperBad",
      ANTHROPIC_API_KEY: "",
      BRAND_DNA_GATE_BYPASS: "true",
      CREDENTIAL_VAULT_KEY,
      KILL_SWITCHES_ON: "setup_wizards_enabled",
    },
  },
});

// Re-exported for fixtures that need to match the webServer's secret +
// DB path.
export const E2E_CONSTANTS = {
  PORT,
  BASE_URL,
  DB_FILE,
  NEXTAUTH_SECRET,
  STRIPE_WEBHOOK_SECRET,
  CREDENTIAL_VAULT_KEY,
};
