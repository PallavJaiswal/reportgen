import type { CanonicalRow } from "@/lib/data/clean-dataset";
import { monthKey, quarterKey, strField } from "./aggregate";
import type { Anomaly } from "./anomalies";

export type DateRange = { start: string; end: string };

function toUtcDate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}

function addDaysIso(dateStr: string, days: number): string {
  const d = toUtcDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Min/max sale date actually present in the data — the anchor for every
 * range preset below, since this is historical business data and "this
 * month" has to mean the data's most recent month, not the real-world
 * today. */
export function getDataDateBounds(salesRows: CanonicalRow[]): DateRange | null {
  let min: string | null = null;
  let max: string | null = null;
  for (const row of salesRows) {
    const d = strField(row, "date");
    if (!d) continue;
    if (min === null || d < min) min = d;
    if (max === null || d > max) max = d;
  }
  return min && max ? { start: min, end: max } : null;
}

export function filterRowsByDateRange<T extends CanonicalRow>(
  rows: T[],
  dateField: string,
  range: DateRange | null
): T[] {
  if (!range) return rows;
  return rows.filter((row) => {
    const d = strField(row, dateField);
    return d !== null && d >= range.start && d <= range.end;
  });
}

/** The immediately preceding period of equal length, for a single "vs.
 * previous period" comparison when no calendar-aligned month/quarter/year
 * applies (an arbitrary custom range). */
export function getPreviousEquivalentRange(range: DateRange): DateRange {
  const lengthDays = Math.round(
    (toUtcDate(range.end).getTime() - toUtcDate(range.start).getTime()) / 86_400_000
  );
  return {
    start: addDaysIso(range.start, -(lengthDays + 1)),
    end: addDaysIso(range.start, -1),
  };
}

export function formatRangeLabel(range: DateRange): string {
  const fmt = (d: string) =>
    toUtcDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (range.start === range.end) return fmt(range.start);
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

/** The full calendar month a date falls in, as a concrete range. */
export function monthToRange(month: string): DateRange {
  const [y, m] = month.split("-").map(Number);
  const nextMonth = new Date(Date.UTC(y, m, 1));
  return { start: `${month}-01`, end: addDaysIso(nextMonth.toISOString().slice(0, 10), -1) };
}

export type RangePreset = { key: string; label: string; range: DateRange | null };

/** Presets anchored to the data's own latest date, not the browser's today.
 * "Current month" (null range) keeps the classic MoM/QoQ/YoY calendar
 * comparison table, which needs full history to look back — every other
 * preset is a concrete, self-contained window that gets a single "vs.
 * previous period" comparison instead. */
export function buildRangePresets(bounds: DateRange): RangePreset[] {
  const { end } = bounds;
  const month = monthKey(end);
  const [y, m] = month.split("-").map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const { start: lastMonthStart, end: lastMonthEnd } = monthToRange(lastMonth);

  const quarter = quarterKey(end);
  const [qy, qNum] = quarter.split("-Q").map(Number);
  const quarterStartMonth = (qNum - 1) * 3 + 1;
  const quarterStart = `${qy}-${String(quarterStartMonth).padStart(2, "0")}-01`;

  const yearStart = `${y}-01-01`;

  return [
    { key: "currentMonth", label: "Current month", range: null },
    { key: "allTime", label: "All time", range: { start: bounds.start, end } },
    { key: "last30", label: "Last 30 days", range: { start: addDaysIso(end, -29), end } },
    { key: "last90", label: "Last 90 days", range: { start: addDaysIso(end, -89), end } },
    { key: "lastMonth", label: "Last month", range: { start: lastMonthStart, end: lastMonthEnd } },
    { key: "thisQuarter", label: "This quarter", range: { start: quarterStart, end } },
    { key: "thisYear", label: "This year", range: { start: yearStart, end } },
    { key: "custom", label: "Custom range", range: null },
  ];
}

/** Converts an anomaly's period key (a week-start date, or a YYYY-MM month
 * key — both formats already used across anomalies.ts) into a concrete span
 * and checks overlap with the selected reporting range. */
export function anomalyOverlapsRange(anomaly: Anomaly, range: DateRange | null): boolean {
  if (!range) return true;
  const period = anomaly.period;
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-").map(Number);
    const spanStart = `${period}-01`;
    const nextMonth = new Date(Date.UTC(y, m, 1));
    const spanEnd = addDaysIso(nextMonth.toISOString().slice(0, 10), -1);
    return spanStart <= range.end && spanEnd >= range.start;
  }
  // Week key: an ISO date string for the Sunday starting that week.
  const spanStart = period;
  const spanEnd = addDaysIso(period, 6);
  return spanStart <= range.end && spanEnd >= range.start;
}
