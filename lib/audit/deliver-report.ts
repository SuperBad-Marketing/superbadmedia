import { renderToPdf } from "@/lib/pdf/render";
import { sendEmail } from "@/lib/channels/email/send";
import { logActivity } from "@/lib/activity-log";
import {
  buildAuditReportHtml,
  auditPdfFilename,
  type AuditReportInput,
} from "./report-template";

export interface DeliverReportInput extends AuditReportInput {
  contactEmail: string;
  contactName: string;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  submissionId: string;
}

export interface DeliverReportResult {
  pdfBuffer: Buffer;
  emailSent: boolean;
  emailMessageId?: string;
}

export async function deliverAuditReport(
  input: DeliverReportInput,
): Promise<DeliverReportResult> {
  const html = buildAuditReportHtml(input);
  const pdfBuffer = await renderToPdf(html);
  const filename = auditPdfFilename(input.businessName);

  const emailBody = [
    `<p>Here's your report. The honest version, not the polite one.</p>`,
    `<p style="color:#888;font-size:13px;">PDF attached: ${filename}</p>`,
  ].join("");

  const result = await sendEmail({
    to: input.contactEmail,
    subject: `Your marketing audit — ${input.businessName}`,
    body: emailBody,
    classification: "transactional",
    purpose: "audit_report_delivery",
    attachments: [{ filename, content: pdfBuffer }],
  });

  if (result.sent) {
    await logActivity({
      companyId: input.companyId ?? null,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
      kind: "audit_pdf_sent",
      body: `Audit report emailed to ${input.contactEmail}`,
      meta: { submission_id: input.submissionId, filename },
    });
  }

  return {
    pdfBuffer,
    emailSent: result.sent,
    emailMessageId: result.messageId,
  };
}
