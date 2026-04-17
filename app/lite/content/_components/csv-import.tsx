"use client";

/**
 * CSV import widget for the newsletter subscriber list (CE-11).
 *
 * Spec §4.2: "CSV import — upload wizard with mandatory permission pass email.
 * Only contacts who click confirm join."
 *
 * Parses client-side, sends parsed rows to server action.
 * Expects CSV with at minimum an `email` column. Optional `name` column.
 */

import { useState, useRef } from "react";
import { importSubscribersAction } from "../list/actions";

export function CsvImport({ companyId }: { companyId: string }) {
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    duplicates: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        setError("No valid rows found. CSV needs at least an 'email' column.");
        return;
      }

      const res = await importSubscribersAction(companyId, rows);
      if (res.ok) {
        setResult({
          imported: res.imported,
          skipped: res.skipped,
          duplicates: res.duplicates,
        });
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to read file.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <h3 className="mb-2 text-sm font-medium">Import from CSV</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        CSV with an <code>email</code> column (optional <code>name</code>).
        Imported contacts start as pending — they must confirm via email before
        becoming active.
      </p>
      <div className="flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200"
        />
        <button
          onClick={handleUpload}
          disabled={loading}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
      {result && (
        <p className="mt-3 text-sm text-emerald-700">
          Imported {result.imported}
          {result.duplicates > 0 && `, ${result.duplicates} duplicates skipped`}
          {result.skipped > 0 && `, ${result.skipped} invalid rows`}.
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Parse CSV text into rows with email + optional name.
 * Handles headers, quoted fields, and various separators.
 */
function parseCsv(text: string): Array<{ email: string; name?: string }> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  // Find email and name column indices from header
  const headerCells = splitCsvLine(lines[0]).map((h) =>
    h.toLowerCase().trim().replace(/^["']|["']$/g, ""),
  );
  const emailIdx = headerCells.findIndex(
    (h) => h === "email" || h === "email_address" || h === "e-mail",
  );
  if (emailIdx === -1) return [];

  const nameIdx = headerCells.findIndex(
    (h) => h === "name" || h === "full_name" || h === "fullname",
  );

  const rows: Array<{ email: string; name?: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const email = cells[emailIdx]?.trim().replace(/^["']|["']$/g, "");
    if (!email) continue;

    const name =
      nameIdx >= 0
        ? cells[nameIdx]?.trim().replace(/^["']|["']$/g, "") || undefined
        : undefined;

    rows.push({ email, name });
  }

  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}
