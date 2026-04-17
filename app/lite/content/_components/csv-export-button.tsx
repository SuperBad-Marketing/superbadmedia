"use client";

/**
 * CSV export button for the subscriber list (CE-11).
 *
 * Spec §4.3: "Full CSV export available: all contacts including removed,
 * with status column. Export cannot be re-imported to bypass removals."
 */

import { useState } from "react";
import { exportSubscribersAction } from "../list/actions";

export function CsvExportButton({ companyId }: { companyId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportSubscribersAction(companyId);
      if (!result.ok) return;

      // Trigger download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-50 disabled:opacity-50"
    >
      {loading ? "Exporting…" : "Export CSV"}
    </button>
  );
}
