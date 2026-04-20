import type { ExportPeriod } from "./export-queries";

const BAS_QUARTERS = [
  { q: "Q3", months: [1, 2, 3], label: "Jan–Mar" },
  { q: "Q4", months: [4, 5, 6], label: "Apr–Jun" },
  { q: "Q1", months: [7, 8, 9], label: "Jul–Sep" },
  { q: "Q2", months: [10, 11, 12], label: "Oct–Dec" },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function basQuarterForDate(d: Date): { year: number; qIndex: number } {
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const qIndex = BAS_QUARTERS.findIndex((q) => (q.months as readonly number[]).includes(month));
  return { year, qIndex };
}

function basQuarterPeriod(year: number, qIndex: number): ExportPeriod {
  const q = BAS_QUARTERS[qIndex];
  const startMonth = q.months[0];
  const endMonth = q.months[2];
  return {
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${lastDay(year, endMonth)}`,
    label: `BAS ${q.q} ${year} (${q.label})`,
  };
}

export function getBasPresets(now: Date = new Date()): ExportPeriod[] {
  const current = basQuarterForDate(now);
  const presets: ExportPeriod[] = [];

  let year = current.year;
  let qIndex = current.qIndex - 1;
  if (qIndex < 0) {
    qIndex = 3;
    year--;
  }
  presets.push(basQuarterPeriod(year, qIndex));

  qIndex--;
  if (qIndex < 0) {
    qIndex = 3;
    year--;
  }
  presets.push(basQuarterPeriod(year, qIndex));

  return presets;
}

function fyPeriod(fyStartYear: number): ExportPeriod {
  return {
    start: `${fyStartYear}-07-01`,
    end: `${fyStartYear + 1}-06-30`,
    label: `FY ${fyStartYear}–${fyStartYear + 1}`,
  };
}

export function getFyPresets(now: Date = new Date()): ExportPeriod[] {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentFyStart = month >= 7 ? year : year - 1;

  return [
    { ...fyPeriod(currentFyStart), label: `Current FY ${currentFyStart}–${currentFyStart + 1}` },
    fyPeriod(currentFyStart - 1),
  ];
}

export function getAllPresets(now: Date = new Date()): ExportPeriod[] {
  return [...getBasPresets(now), ...getFyPresets(now)];
}

export function customPeriod(start: string, end: string): ExportPeriod {
  return {
    start,
    end,
    label: `Custom ${start} to ${end}`,
  };
}
