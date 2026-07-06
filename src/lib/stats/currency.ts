import type { CanonicalRow } from "@/lib/data/clean-dataset";
import { UNMAPPED_STRING_VALUE } from "@/lib/data/clean-dataset";
import { strField, numField } from "./aggregate";
import type { PerformerDimension } from "./performers";

export type CurrencyBreakdownRow = {
  currency: string;
  revenue: number;
  units: number;
  orders: number;
  returns: number;
  refund: number;
};

type CurrencyDatasets = {
  salesRows: CanonicalRow[];
  ordersRows: CanonicalRow[];
  returnsRows: CanonicalRow[];
};

function currencyOf(row: CanonicalRow): string | null {
  const c = strField(row, "currency");
  return c ? c.toUpperCase() : null;
}

function distinctCurrencies(rows: CanonicalRow[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const c = currencyOf(row);
    if (c) set.add(c);
  }
  return set;
}

/** Sums across rows never convert currency — blending a USD total with an
 * INR total would silently overstate revenue by ~80x per mixed row. Instead
 * of guessing a conversion rate we don't have, every figure in the app gets
 * scoped to one currency at a time; this is the "what currencies exist"
 * building block the rest of the module and the UI selector are built on. */
export function getAvailableCurrencies(datasets: CurrencyDatasets): string[] {
  const set = new Set<string>([
    ...distinctCurrencies(datasets.salesRows),
    ...distinctCurrencies(datasets.ordersRows),
    ...distinctCurrencies(datasets.returnsRows),
  ]);
  return [...set].sort();
}

/** The currency with the most Sales rows, excluding the "no currency column
 * mapped" placeholder — used as the default reporting currency when the
 * user hasn't explicitly chosen one. */
export function getDefaultCurrency(salesRows: CanonicalRow[]): string | null {
  const counts = new Map<string, number>();
  for (const row of salesRows) {
    const c = currencyOf(row);
    if (!c || c === UNMAPPED_STRING_VALUE.toUpperCase()) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Rows with no currency value at all are excluded rather than assumed into
 * whichever currency is selected — silently guessing would reintroduce the
 * exact mixing this module exists to prevent. */
export function filterRowsByCurrency<T extends CanonicalRow>(rows: T[], currency: string | null): T[] {
  if (!currency) return rows;
  return rows.filter((row) => currencyOf(row) === currency);
}

/** A per-currency total, computed independently for each currency so the
 * dashboard can show the full multi-currency picture without ever blending
 * two currencies into one number. */
export type CurrencyDimensionGroup = {
  currency: string;
  rows: { dimensionValue: string; current: number }[];
};

/** Revenue by SKU/region/channel, grouped independently per currency —
 * never summed across currencies. Unlike filtering to a single "active"
 * currency first, this lets a dimension chart show every category each
 * currency actually touches, so switching which currency drives the KPI
 * cards doesn't silently shrink an unrelated chart down to whichever one
 * category happens to share that currency. */
export function computeDimensionBreakdownByCurrency(
  rows: CanonicalRow[],
  dimensionField: PerformerDimension
): CurrencyDimensionGroup[] {
  const byCurrency = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const dim = strField(row, dimensionField);
    if (!dim || dim === UNMAPPED_STRING_VALUE) continue;
    const currency = currencyOf(row) ?? "UNKNOWN";
    const dimMap = byCurrency.get(currency) ?? new Map<string, number>();
    dimMap.set(dim, (dimMap.get(dim) ?? 0) + numField(row, "revenue"));
    byCurrency.set(currency, dimMap);
  }
  return [...byCurrency.entries()]
    .map(([currency, dimMap]) => ({
      currency,
      rows: [...dimMap.entries()]
        .map(([dimensionValue, current]) => ({ dimensionValue, current }))
        .sort((a, b) => b.current - a.current),
    }))
    .sort((a, b) => {
      const totalA = a.rows.reduce((sum, r) => sum + r.current, 0);
      const totalB = b.rows.reduce((sum, r) => sum + r.current, 0);
      return totalB - totalA;
    });
}

export function computeCurrencyBreakdown(datasets: CurrencyDatasets): CurrencyBreakdownRow[] {
  const currencies = getAvailableCurrencies(datasets);
  return currencies
    .map((currency) => {
      const sales = filterRowsByCurrency(datasets.salesRows, currency);
      const orders = filterRowsByCurrency(datasets.ordersRows, currency);
      const returns = filterRowsByCurrency(datasets.returnsRows, currency);
      return {
        currency,
        revenue: sales.reduce((sum, r) => sum + numField(r, "revenue"), 0),
        units: sales.reduce((sum, r) => sum + numField(r, "units"), 0),
        orders: orders.length,
        returns: returns.length,
        refund: returns.reduce((sum, r) => sum + numField(r, "refund"), 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
