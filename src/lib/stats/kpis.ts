import type { CanonicalRow } from "@/lib/data/clean-dataset";
import { monthKey, quarterKey, shiftMonth, shiftQuarter, numField, strField } from "./aggregate";
import { filterRowsByDateRange, type DateRange } from "./date-range";

export type KpiId = "revenue" | "units" | "orders" | "returnRate" | "avgMargin";
export type KpiFormat = "currency" | "number" | "percent";

export type KpiDefinition = {
  id: KpiId;
  label: string;
  format: KpiFormat;
  higherIsBetter: boolean;
};

export const KPI_DEFINITIONS: KpiDefinition[] = [
  { id: "revenue", label: "Total revenue", format: "currency", higherIsBetter: true },
  { id: "units", label: "Units sold", format: "number", higherIsBetter: true },
  { id: "orders", label: "Order volume", format: "number", higherIsBetter: true },
  { id: "returnRate", label: "Return rate", format: "percent", higherIsBetter: false },
  { id: "avgMargin", label: "Avg. margin", format: "percent", higherIsBetter: true },
];

export type KpiInputs = {
  salesRows: CanonicalRow[];
  ordersRows: CanonicalRow[];
  returnsRows: CanonicalRow[];
  unitCostBySku: Map<string, number>;
};

type KpiSnapshot = Record<KpiId, number | null>;

export function computeKpiSnapshot(
  sales: CanonicalRow[],
  orders: CanonicalRow[],
  returns: CanonicalRow[],
  unitCostBySku: Map<string, number>
): KpiSnapshot {
  const revenue = sales.reduce((sum, r) => sum + numField(r, "revenue"), 0);
  const units = sales.reduce((sum, r) => sum + numField(r, "units"), 0);
  const returnedUnits = returns.reduce((sum, r) => sum + numField(r, "units"), 0);
  const returnRate = units > 0 ? returnedUnits / units : null;

  let cost = 0;
  for (const r of sales) {
    const sku = strField(r, "sku");
    const unitCost = sku ? unitCostBySku.get(sku) : undefined;
    if (unitCost !== undefined) cost += unitCost * numField(r, "units");
  }
  const avgMargin = unitCostBySku.size > 0 && revenue > 0 ? (revenue - cost) / revenue : null;

  return { revenue, units, orders: orders.length, returnRate, avgMargin };
}

function byMonth(rows: CanonicalRow[], dateField: string, month: string): CanonicalRow[] {
  return rows.filter((r) => {
    const d = strField(r, dateField);
    return d ? monthKey(d) === month : false;
  });
}

function byQuarter(rows: CanonicalRow[], dateField: string, quarter: string): CanonicalRow[] {
  return rows.filter((r) => {
    const d = strField(r, dateField);
    return d ? quarterKey(d) === quarter : false;
  });
}

function deltaPct(current: number | null, previous: number | null, hasPrev: boolean): number | null {
  if (current === null || previous === null || !hasPrev || previous === 0) return null;
  return (current - previous) / previous;
}

export type KpiTrendRow = KpiDefinition & {
  current: number | null;
  mom: number | null;
  qoq: number | null;
  yoy: number | null;
};

export type KpiTrends = {
  anchorMonth: string | null;
  rows: KpiTrendRow[];
};

/** Computes each KPI for the latest complete month present in the data, plus
 * month/quarter/year-over-period deltas against it. */
export function computeKpiTrends(inputs: KpiInputs): KpiTrends {
  const months = inputs.salesRows
    .map((r) => strField(r, "date"))
    .filter((d): d is string => !!d)
    .map(monthKey);
  if (months.length === 0) return { anchorMonth: null, rows: [] };

  const anchorMonth = months.reduce((max, m) => (m > max ? m : max));
  const anchorQuarter = quarterKey(`${anchorMonth}-01`);
  const momPrevMonth = shiftMonth(anchorMonth, -1);
  const qoqPrevQuarter = shiftQuarter(anchorQuarter, -1);
  const yoyPrevMonth = shiftMonth(anchorMonth, -12);

  const currentMonthSnapshot = computeKpiSnapshot(
    byMonth(inputs.salesRows, "date", anchorMonth),
    byMonth(inputs.ordersRows, "orderDate", anchorMonth),
    byMonth(inputs.returnsRows, "returnDate", anchorMonth),
    inputs.unitCostBySku
  );
  const momSnapshot = computeKpiSnapshot(
    byMonth(inputs.salesRows, "date", momPrevMonth),
    byMonth(inputs.ordersRows, "orderDate", momPrevMonth),
    byMonth(inputs.returnsRows, "returnDate", momPrevMonth),
    inputs.unitCostBySku
  );
  const currentQuarterSnapshot = computeKpiSnapshot(
    byQuarter(inputs.salesRows, "date", anchorQuarter),
    byQuarter(inputs.ordersRows, "orderDate", anchorQuarter),
    byQuarter(inputs.returnsRows, "returnDate", anchorQuarter),
    inputs.unitCostBySku
  );
  const qoqSnapshot = computeKpiSnapshot(
    byQuarter(inputs.salesRows, "date", qoqPrevQuarter),
    byQuarter(inputs.ordersRows, "orderDate", qoqPrevQuarter),
    byQuarter(inputs.returnsRows, "returnDate", qoqPrevQuarter),
    inputs.unitCostBySku
  );
  const yoySnapshot = computeKpiSnapshot(
    byMonth(inputs.salesRows, "date", yoyPrevMonth),
    byMonth(inputs.ordersRows, "orderDate", yoyPrevMonth),
    byMonth(inputs.returnsRows, "returnDate", yoyPrevMonth),
    inputs.unitCostBySku
  );

  const hasMomData = byMonth(inputs.salesRows, "date", momPrevMonth).length > 0;
  const hasQoqData =
    qoqPrevQuarter !== anchorQuarter && byQuarter(inputs.salesRows, "date", qoqPrevQuarter).length > 0;
  const hasYoyData = byMonth(inputs.salesRows, "date", yoyPrevMonth).length > 0;

  const rows: KpiTrendRow[] = KPI_DEFINITIONS.map((def) => ({
    ...def,
    current: currentMonthSnapshot[def.id],
    mom: deltaPct(currentMonthSnapshot[def.id], momSnapshot[def.id], hasMomData),
    qoq: deltaPct(currentQuarterSnapshot[def.id], qoqSnapshot[def.id], hasQoqData),
    yoy: deltaPct(currentMonthSnapshot[def.id], yoySnapshot[def.id], hasYoyData),
  }));

  return { anchorMonth, rows };
}

/** Computes each KPI summed over an arbitrary custom date range, with a
 * single "vs. previous period" delta against the immediately preceding
 * range of equal length — QoQ/YoY don't apply to an arbitrary window, so
 * those come back null (the UI hides those columns in range mode). */
export function computeKpiRangeTrend(
  inputs: KpiInputs,
  range: DateRange,
  previousRange: DateRange
): KpiTrends {
  const currentSnapshot = computeKpiSnapshot(
    filterRowsByDateRange(inputs.salesRows, "date", range),
    filterRowsByDateRange(inputs.ordersRows, "orderDate", range),
    filterRowsByDateRange(inputs.returnsRows, "returnDate", range),
    inputs.unitCostBySku
  );
  const previousSales = filterRowsByDateRange(inputs.salesRows, "date", previousRange);
  const previousSnapshot = computeKpiSnapshot(
    previousSales,
    filterRowsByDateRange(inputs.ordersRows, "orderDate", previousRange),
    filterRowsByDateRange(inputs.returnsRows, "returnDate", previousRange),
    inputs.unitCostBySku
  );
  const hasPreviousData = previousSales.length > 0;

  const rows: KpiTrendRow[] = KPI_DEFINITIONS.map((def) => ({
    ...def,
    current: currentSnapshot[def.id],
    mom: deltaPct(currentSnapshot[def.id], previousSnapshot[def.id], hasPreviousData),
    qoq: null,
    yoy: null,
  }));

  return { anchorMonth: null, rows };
}

/** Monthly revenue series across the full data range, for the trend chart. */
export function monthlyRevenueSeries(salesRows: CanonicalRow[]): { month: string; revenue: number }[] {
  const map = new Map<string, number>();
  for (const row of salesRows) {
    const date = strField(row, "date");
    if (!date) continue;
    const key = monthKey(date);
    map.set(key, (map.get(key) ?? 0) + numField(row, "revenue"));
  }
  return [...map.entries()]
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
