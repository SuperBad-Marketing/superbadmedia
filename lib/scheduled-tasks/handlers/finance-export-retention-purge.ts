import fs from "node:fs";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";
import { and, eq, lte } from "drizzle-orm";
import settings from "@/lib/settings";

const MS_PER_DAY = 86_400_000;

const handleFinanceExportRetentionPurge: TaskHandler = async (_task) => {
  const retentionDays = await settings.get("finance.export_retention_days");
  const cutoffMs = Date.now() - retentionDays * MS_PER_DAY;

  const staleExports = await db
    .select()
    .from(finance_exports)
    .where(
      and(
        eq(finance_exports.status, "ready"),
        lte(finance_exports.completed_at_ms, cutoffMs),
      ),
    )
    .all();

  for (const exp of staleExports) {
    if (exp.file_path) {
      try {
        fs.unlinkSync(exp.file_path);
      } catch {
        // file already gone — that's fine
      }
    }
    await db
      .update(finance_exports)
      .set({ status: "purged", file_path: null })
      .where(eq(finance_exports.id, exp.id));
  }
};

export const FINANCE_EXPORT_RETENTION_PURGE_HANDLERS: HandlerMap = {
  finance_export_retention_purge: handleFinanceExportRetentionPurge,
};
