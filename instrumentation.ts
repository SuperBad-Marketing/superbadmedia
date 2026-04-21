export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!process.env.AUTH_TRUST_HOST) {
      process.env.AUTH_TRUST_HOST = "true";
    }

    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { runMigrations } = await import("./lib/db/migrate");
      const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
      try {
        runMigrations(dbUrl);
        console.info("[instrumentation] migrations applied successfully");
      } catch (err) {
        console.error("[instrumentation] migration failed:", err);
      }
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  await import("@/lib/env");
}
