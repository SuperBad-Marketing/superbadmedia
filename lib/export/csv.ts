/**
 * Minimal CSV generator — no dependencies.
 * Owner: CM-9. Consumer: data-export handler.
 */

export function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}
