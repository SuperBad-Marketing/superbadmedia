export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./lib/db/migrate");
    const dbUrl = process.env.DATABASE_URL ?? "file:./dev.db";
    try {
      runMigrations(dbUrl);
    } catch (err) {
      console.error("[instrumentation] migration failed:", err);
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }

  await import("@/lib/env");
}
