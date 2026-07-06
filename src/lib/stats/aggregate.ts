import { UNMAPPED_STRING_VALUE, type CanonicalRow } from "@/lib/data/clean-dataset";

export function numField(row: CanonicalRow, key: string): number {
  const v = row[key];
  return typeof v === "number" ? v : 0;
}

export function strField(row: CanonicalRow, key: string): string | null {
  const v = row[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function quarterKey(dateStr: string): string {
  const [y, m] = dateStr.split("-").map(Number);
  return `${y}-Q${Math.ceil(m / 3)}`;
}

/** ISO-ish week key (Sunday-start) — coarse enough to smooth day-level noise
 * while still isolating a multi-day spike. */
export function weekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay();
  const weekStart = new Date(d);
  weekStart.setUTCDate(d.getUTCDate() - dayOfWeek);
  return weekStart.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function shiftQuarter(quarter: string, delta: number): string {
  const [yStr, qStr] = quarter.split("-Q");
  const totalQuarters = Number(yStr) * 4 + (Number(qStr) - 1) + delta;
  const y = Math.floor(totalQuarters / 4);
  const q = (totalQuarters % 4) + 1;
  return `${y}-Q${q}`;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[], m = mean(values)): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  const pos = (sortedValues.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sortedValues[base + 1];
  return next === undefined ? sortedValues[base] : sortedValues[base] + rest * (next - sortedValues[base]);
}

export type Bucket = { key: string; value: number; rows: CanonicalRow[] };

/** Groups rows into buckets by a derived key (e.g. month), summing a metric
 * and retaining the contributing rows so anomalies can drill back to source data. */
export function bucketRows(
  rows: CanonicalRow[],
  dateField: string,
  keyFn: (dateStr: string) => string,
  valueFn: (row: CanonicalRow) => number
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const row of rows) {
    const date = row[dateField];
    if (typeof date !== "string" || !date) continue;
    const key = keyFn(date);
    const existing = map.get(key);
    if (existing) {
      existing.value += valueFn(row);
      existing.rows.push(row);
    } else {
      map.set(key, { key, value: valueFn(row), rows: [row] });
    }
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Same as bucketRows, but grouped first by a dimension (region, sku, ...)
 * then bucketed by date within each dimension value. */
export function bucketRowsByDimension(
  rows: CanonicalRow[],
  dimensionField: string,
  dateField: string,
  keyFn: (dateStr: string) => string,
  valueFn: (row: CanonicalRow) => number
): Map<string, Bucket[]> {
  const byDimension = new Map<string, CanonicalRow[]>();
  for (const row of rows) {
    const dim = row[dimensionField];
    if (typeof dim !== "string" || !dim || dim === UNMAPPED_STRING_VALUE) continue;
    const list = byDimension.get(dim);
    if (list) list.push(row);
    else byDimension.set(dim, [row]);
  }

  const result = new Map<string, Bucket[]>();
  for (const [dim, dimRows] of byDimension) {
    result.set(dim, bucketRows(dimRows, dateField, keyFn, valueFn));
  }
  return result;
}
