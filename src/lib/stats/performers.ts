import { UNMAPPED_STRING_VALUE, type CanonicalRow } from "@/lib/data/clean-dataset";
import { monthKey, numField, strField } from "./aggregate";
import type { DateRange } from "./date-range";

export type PerformerDimension = "sku" | "region" | "channel";

export type PerformerRow = {
  dimensionValue: string;
  current: number;
  previous: number | null;
  deltaPct: number | null;
};

/** Distinct channel values across Sales and Orders — the only two datasets
 * that carry a channel field. Unlike currency, channels can be validly
 * summed together, so this just powers an optional narrowing filter rather
 * than a forced choice. */
export function getAvailableChannels(salesRows: CanonicalRow[], ordersRows: CanonicalRow[]): string[] {
  const set = new Set<string>();
  for (const rows of [salesRows, ordersRows]) {
    for (const row of rows) {
      const c = strField(row, "channel");
      if (c && c !== UNMAPPED_STRING_VALUE) set.add(c);
    }
  }
  return [...set].sort();
}

export function filterRowsByChannel<T extends CanonicalRow>(rows: T[], channel: string | null): T[] {
  if (!channel) return rows;
  return rows.filter((row) => strField(row, "channel") === channel);
}

/** Ranks a dimension (SKU/region/channel) by revenue in the latest month,
 * with month-over-month trend, for top/bottom performer identification. */
export function rankPerformers(
  salesRows: CanonicalRow[],
  dimensionField: PerformerDimension,
  currentMonth: string
): PerformerRow[] {
  const previousMonth = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 2, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  const byDim = new Map<string, { current: number; previous: number }>();

  for (const row of salesRows) {
    const dim = strField(row, dimensionField);
    const date = strField(row, "date");
    if (!dim || dim === UNMAPPED_STRING_VALUE || !date) continue;
    const month = monthKey(date);
    if (month !== currentMonth && month !== previousMonth) continue;

    const entry = byDim.get(dim) ?? { current: 0, previous: 0 };
    if (month === currentMonth) entry.current += numField(row, "revenue");
    else entry.previous += numField(row, "revenue");
    byDim.set(dim, entry);
  }

  return [...byDim.entries()]
    .map(([dimensionValue, v]) => ({
      dimensionValue,
      current: v.current,
      previous: v.previous > 0 ? v.previous : null,
      deltaPct: v.previous > 0 ? (v.current - v.previous) / v.previous : null,
    }))
    .sort((a, b) => b.current - a.current);
}

/** Same ranking as rankPerformers, but summed over an arbitrary date range
 * (with a comparison range of equal length) instead of an exact calendar
 * month — used whenever a custom reporting window is selected. */
export function rankPerformersInRange(
  salesRows: CanonicalRow[],
  dimensionField: PerformerDimension,
  range: DateRange,
  previousRange: DateRange
): PerformerRow[] {
  const byDim = new Map<string, { current: number; previous: number }>();

  for (const row of salesRows) {
    const dim = strField(row, dimensionField);
    const date = strField(row, "date");
    if (!dim || dim === UNMAPPED_STRING_VALUE || !date) continue;

    const inCurrent = date >= range.start && date <= range.end;
    const inPrevious = date >= previousRange.start && date <= previousRange.end;
    if (!inCurrent && !inPrevious) continue;

    const entry = byDim.get(dim) ?? { current: 0, previous: 0 };
    if (inCurrent) entry.current += numField(row, "revenue");
    else entry.previous += numField(row, "revenue");
    byDim.set(dim, entry);
  }

  return [...byDim.entries()]
    .map(([dimensionValue, v]) => ({
      dimensionValue,
      current: v.current,
      previous: v.previous > 0 ? v.previous : null,
      deltaPct: v.previous > 0 ? (v.current - v.previous) / v.previous : null,
    }))
    .sort((a, b) => b.current - a.current);
}
