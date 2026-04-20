import fs from "node:fs";
import path from "node:path";
import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import { db } from "@/lib/db";
import { finance_exports } from "@/lib/db/schema/finance-exports";
import { eq } from "drizzle-orm";
import { generateFinanceExportBundle } from "@/lib/finance/generate-export-bundle";
import { sendEmail } from "@/lib/channels/email";
import { logActivity } from "@/lib/activity-log";

const EXPORTS_DIR = path.join(process.cwd(), "var", "exports", "finance");

const handleFinanceExportGenerate: TaskHandler = async (task) => {
  const payload = task.payload as {
    export_id: string;
    period_start: string;
    period_end: string;
    period_label: string;
  };

  await db
    .update(finance_exports)
    .set({ status: "generating" })
    .where(eq(finance_exports.id, payload.export_id));

  try {
    const bundle = await generateFinanceExportBundle({
      start: payload.period_start,
      end: payload.period_end,
      label: payload.period_label,
    });

    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    const filePath = path.join(EXPORTS_DIR, bundle.filename);
    fs.writeFileSync(filePath, bundle.buffer);

    await db
      .update(finance_exports)
      .set({
        status: "ready",
        file_path: filePath,
        filename: bundle.filename,
        file_size_bytes: bundle.buffer.length,
        completed_at_ms: Date.now(),
      })
      .where(eq(finance_exports.id, payload.export_id));

    const attachments =
      bundle.buffer.length <= 10 * 1024 * 1024
        ? [{ filename: bundle.filename, content: bundle.buffer }]
        : [];

    await sendEmail({
      to: process.env.ADMIN_EMAIL ?? "andy@superbadmedia.com.au",
      subject: `Finance export ready — ${payload.period_label}`,
      body: `<p>Your finance bundle for <strong>${payload.period_label}</strong> is ready.</p><p>Download it from the Finance &gt; Export page in SuperBad.</p><p>Contents: BAS summary PDF, P&amp;L PDF, transactions CSV, expenses CSV, invoices CSV, per-client revenue CSV.</p>`,
      classification: "transactional",
      purpose: "finance_export_ready",
      attachments,
    });

    await logActivity({
      kind: "finance_export_generated",
      body: `Finance export generated for ${payload.period_label}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(finance_exports)
      .set({
        status: "failed",
        error_message: message,
        completed_at_ms: Date.now(),
      })
      .where(eq(finance_exports.id, payload.export_id));
    throw err;
  }
};

export const FINANCE_EXPORT_GENERATE_HANDLERS: HandlerMap = {
  finance_export_generate: handleFinanceExportGenerate,
};
