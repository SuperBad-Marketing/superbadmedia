/**
 * Orchestrate ZIP generation for a company data export.
 * Owner: CM-9. Consumer: client-data-export handler.
 */
import JSZip from "jszip";
import { gatherCompanyData } from "./gather";
import { toCsv } from "./csv";
import { renderInvoicePdf } from "@/lib/invoicing/render-invoice-pdf";
import { renderQuotePdf } from "@/lib/quote-builder/render-quote-pdf";
import { renderToPdf } from "@/lib/pdf/render";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatDate(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toISOString().split("T")[0];
}

function buildBrandDnaHtml(
  displayName: string | null,
  prose: string,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Brand DNA Profile</title>
<style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:20px;color:#1a1a1a;line-height:1.7}
h1{font-size:28px;margin-bottom:8px}p.sub{color:#666;font-size:14px;margin-top:0}
.prose{font-size:16px;white-space:pre-wrap}</style></head>
<body><h1>${displayName ?? "Brand DNA Profile"}</h1>
<p class="sub">SuperBad Marketing</p>
<div class="prose">${prose}</div></body></html>`;
}

export async function generateExportZip(
  companyId: string,
  companyName: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await gatherCompanyData(companyId);
  const zip = new JSZip();
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `superbad-${slugify(companyName)}-export-${dateStr}.zip`;

  // CSVs
  if (data.contacts.length > 0) {
    zip.file(
      "contacts.csv",
      toCsv(
        ["id", "name", "role", "email", "phone", "is_primary", "relationship_type", "created_at_ms"],
        data.contacts,
      ),
    );
  }

  if (data.deals.length > 0) {
    zip.file(
      "deals.csv",
      toCsv(
        ["id", "stage", "title", "value_cents", "won_outcome", "loss_reason", "created_at_ms", "updated_at_ms"],
        data.deals,
      ),
    );
  }

  if (data.communications.length > 0) {
    zip.file(
      "communications.csv",
      toCsv(["id", "channel", "direction", "subject", "date"], data.communications),
    );
  }

  if (data.invoices.length > 0) {
    zip.file(
      "invoices.csv",
      toCsv(
        ["id", "invoice_number", "status", "total_cents_inc_gst", "total_cents_ex_gst", "gst_cents", "issue_date_ms", "due_at_ms", "paid_at_ms"],
        data.invoices,
      ),
    );
  }

  if (data.actionItems.length > 0) {
    zip.file(
      "action-items.csv",
      toCsv(["id", "kind", "body", "created_at_ms"], data.actionItems),
    );
  }

  if (data.brandDnaTags.length > 0) {
    zip.file(
      "brand-dna-tags.csv",
      toCsv(["profile_id", "question_id", "section", "tags_awarded"], data.brandDnaTags),
    );
  }

  // Brand DNA prose portrait PDFs
  const completedProfiles = data.brandDnaProfiles.filter(
    (p) => p.prose_portrait,
  );
  for (const profile of completedProfiles) {
    try {
      const html = buildBrandDnaHtml(
        profile.subject_display_name,
        profile.prose_portrait!,
      );
      const pdfBuffer = await renderToPdf(html, {
        filename: `brand-dna-profile-${profile.id}.pdf`,
      });
      zip.file("brand-dna-profile.pdf", pdfBuffer);
    } catch {
      // PDF rendering may fail if Puppeteer isn't available — skip gracefully
    }
  }

  // Invoice PDFs
  const invoicesFolder = zip.folder("invoices");
  for (const invoiceId of data.invoiceIds) {
    try {
      const result = await renderInvoicePdf(invoiceId);
      invoicesFolder!.file(result.filename, result.buffer);
    } catch {
      // skip individual failures
    }
  }

  // Quote PDFs
  const quotesFolder = zip.folder("quotes");
  for (const quoteId of data.quoteIds) {
    try {
      const result = await renderQuotePdf(quoteId);
      quotesFolder!.file(result.filename, result.buffer);
    } catch {
      // skip individual failures
    }
  }

  // Manifest of external links (placeholder — external_links table not yet built)
  zip.file(
    "manifest.txt",
    `SuperBad Data Export — ${companyName}\nGenerated: ${dateStr}\n\nExternal links will appear here when the external-links feature ships.\n`,
  );

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer: Buffer.from(zipBuffer), filename };
}
