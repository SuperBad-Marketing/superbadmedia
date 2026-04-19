import type { HandlerMap, TaskHandler } from "@/lib/scheduled-tasks/worker";
import type { ScheduledTaskRow } from "@/lib/db/schema/scheduled-tasks";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { companies } from "@/lib/db/schema/companies";
import { portal_chat_messages } from "@/lib/db/schema/portal-chat-messages";
import { generateExportZip } from "@/lib/export/generate-zip";
import { storeExportZip } from "@/lib/export/storage";
import { logActivity } from "@/lib/activity-log";

interface ClientDataExportPayload {
  company_id: string;
  triggered_by: "admin" | "client";
  contact_id?: string;
}

function readPayload<T>(task: ScheduledTaskRow, taskType: string): T {
  const payload = task.payload as T | null;
  if (!payload) {
    throw new Error(`${taskType}: missing payload (task ${task.id})`);
  }
  return payload;
}

const clientDataExport: TaskHandler = async (task) => {
  const payload = readPayload<ClientDataExportPayload>(
    task,
    "client_data_export",
  );

  const company = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, payload.company_id))
    .get();

  if (!company) {
    throw new Error(
      `client_data_export: company ${payload.company_id} not found`,
    );
  }

  const { buffer, filename } = await generateExportZip(
    company.id,
    company.name,
  );

  const exportId = `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const meta = await storeExportZip(exportId, buffer, filename);

  await logActivity({
    companyId: company.id,
    contactId: payload.contact_id ?? null,
    kind: "data_export_completed",
    body: `Data export ready: ${filename} (${(meta.sizeBytes / 1024).toFixed(0)} KB)`,
    meta: {
      export_id: exportId,
      filename,
      size_bytes: meta.sizeBytes,
      expires_at_ms: meta.expiresAtMs,
      triggered_by: payload.triggered_by,
    },
  });

  if (payload.triggered_by === "client" && payload.contact_id) {
    const downloadUrl = `/api/lite/exports/${exportId}`;
    await db.insert(portal_chat_messages).values({
      contact_id: payload.contact_id,
      role: "assistant",
      content: `your data export is ready. [download ${filename}](${downloadUrl}) — this link expires in 7 days.`,
      tool_action: `trigger_export:${exportId}`,
      created_at_ms: Date.now(),
    });
  }
};

export const CLIENT_DATA_EXPORT_HANDLERS: HandlerMap = {
  client_data_export: clientDataExport,
};
