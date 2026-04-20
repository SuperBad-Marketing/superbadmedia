import JSZip from "jszip";
import { renderToPdf } from "@/lib/pdf/render";
import { toCsv } from "@/lib/export/csv";
import {
  getExportTransactions,
  getExportInvoices,
  getExportExpenses,
  getClientRevenue,
  computeBasSummary,
  computePandLSummary,
  type ExportPeriod,
} from "./export-queries";
import { buildBasPdfHtml, buildPandLPdfHtml, exportFilename } from "./pdf-templates";

export interface GeneratedBundle {
  buffer: Buffer;
  filename: string;
  periodLabel: string;
}

export async function generateFinanceExportBundle(
  period: ExportPeriod,
): Promise<GeneratedBundle> {
  const zip = new JSZip();
  const slug = exportFilename(period.label);

  const [basSummary, pandlSummary, transactions, invoiceRows, expenseRows, clientRevenue] =
    await Promise.all([
      computeBasSummary(period),
      computePandLSummary(period),
      getExportTransactions(period),
      getExportInvoices(period),
      getExportExpenses(period),
      getClientRevenue(period),
    ]);

  const basHtml = buildBasPdfHtml(basSummary);
  const pandlHtml = buildPandLPdfHtml(pandlSummary);

  const [basPdf, pandlPdf] = await Promise.all([
    renderToPdf(basHtml),
    renderToPdf(pandlHtml),
  ]);

  zip.file("bas-summary.pdf", basPdf);
  zip.file("profit-and-loss.pdf", pandlPdf);

  if (transactions.length > 0) {
    zip.file(
      "transactions.csv",
      toCsv(
        ["date", "type", "description", "counterparty", "category", "amount_inc_gst", "gst_amount", "amount_ex_gst", "source_id"],
        transactions as unknown as Record<string, unknown>[],
      ),
    );
  }

  if (expenseRows.length > 0) {
    zip.file(
      "expenses.csv",
      toCsv(
        ["date", "vendor", "category", "description", "status", "source", "amount_inc_gst", "gst_amount", "amount_ex_gst"],
        expenseRows as unknown as Record<string, unknown>[],
      ),
    );
  }

  if (invoiceRows.length > 0) {
    zip.file(
      "invoices.csv",
      toCsv(
        ["invoice_number", "company_name", "status", "issue_date", "due_date", "paid_date", "amount_inc_gst", "gst_amount", "amount_ex_gst"],
        invoiceRows as unknown as Record<string, unknown>[],
      ),
    );
  }

  if (clientRevenue.length > 0) {
    zip.file(
      "per-client-revenue.csv",
      toCsv(
        ["company_name", "invoices_paid", "total_inc_gst", "total_gst", "total_ex_gst"],
        clientRevenue as unknown as Record<string, unknown>[],
      ),
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${slug}.zip`;

  return {
    buffer: Buffer.from(zipBuffer),
    filename,
    periodLabel: period.label,
  };
}
