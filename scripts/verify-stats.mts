// One-off sanity check of the stats engine (KPIs, anomalies, performers, risks)
// against the sample CSVs.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import { DATASET_SCHEMAS, mapColumns, type DatasetType } from "../src/lib/data/schema";
import { dedupeRows, buildCanonicalRows, type CleaningResult } from "../src/lib/data/clean-dataset";
import { computeKpiTrends, monthlyRevenueSeries } from "../src/lib/stats/kpis";
import {
  detectSkuUnitAnomalies,
  detectSkuReturnAnomalies,
  detectRollingBaselineAnomalies,
} from "../src/lib/stats/anomalies";
import { rankPerformers } from "../src/lib/stats/performers";
import { synthesizeRisksAndOpportunities } from "../src/lib/stats/risks";
import { strField, numField } from "../src/lib/stats/aggregate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "public", "sample-data");

const FILES: Record<DatasetType, string> = {
  sales: "sample-sales.csv",
  orders: "sample-orders.csv",
  inventory: "sample-inventory.csv",
  returns: "sample-returns.csv",
};

const results: Partial<Record<DatasetType, CleaningResult>> = {};

for (const [key, filename] of Object.entries(FILES) as [DatasetType, string][]) {
  const text = readFileSync(path.join(DATA_DIR, filename), "utf-8");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const schema = DATASET_SCHEMAS[key];
  const mapping = mapColumns(schema, parsed.meta.fields ?? []);
  const { rows: deduped, duplicatesRemoved } = dedupeRows(parsed.data);
  const built = buildCanonicalRows(schema, mapping, deduped);
  results[key] = {
    datasetType: key,
    mapping,
    rows: built.rows,
    counts: {
      totalRawRows: parsed.data.length,
      duplicatesRemoved,
      nullsHandled: built.nullsHandled,
      rowsDroppedMissingRequired: built.rowsDroppedMissingRequired,
      typeMismatchesCoerced: built.typeMismatchesCoerced,
      cleanRowCount: built.rows.length,
    },
  };
}

const salesRows = results.sales!.rows;
const ordersRows = results.orders!.rows;
const inventoryRows = results.inventory!.rows;
const returnsRows = results.returns!.rows;

const unitCostBySku = new Map<string, number>();
for (const row of inventoryRows) {
  const sku = strField(row, "sku");
  if (sku && !unitCostBySku.has(sku)) unitCostBySku.set(sku, numField(row, "unitCost"));
}

console.log("== KPI trends ==");
const trends = computeKpiTrends({ salesRows, ordersRows, returnsRows, unitCostBySku });
console.log("anchor month:", trends.anchorMonth);
console.table(
  trends.rows.map((r) => ({
    kpi: r.label,
    current: r.current,
    mom: r.mom,
    qoq: r.qoq,
    yoy: r.yoy,
  }))
);

console.log("\n== monthly revenue series (last 6) ==");
console.log(monthlyRevenueSeries(salesRows).slice(-6));

console.log("\n== SKU unit anomalies (z-score, threshold 2.5) ==");
const skuAnomalies = detectSkuUnitAnomalies(salesRows, "zscore", 2.5);
console.log(`found ${skuAnomalies.length}`);
console.table(
  skuAnomalies.slice(0, 10).map((a) => ({
    sku: a.dimensionValue,
    period: a.period,
    observed: a.observed,
    baseline: Math.round(a.baseline),
    z: a.deviation.toFixed(2),
    severity: a.severity,
  }))
);

console.log("\n== SKU return anomalies (z-score, threshold 2.5) ==");
const returnAnomalies = detectSkuReturnAnomalies(returnsRows, "zscore", 2.5);
console.log(`found ${returnAnomalies.length}`);
console.table(
  returnAnomalies.slice(0, 10).map((a) => ({
    sku: a.dimensionValue,
    period: a.period,
    observed: a.observed,
    baseline: Math.round(a.baseline * 10) / 10,
    z: a.deviation.toFixed(2),
  }))
);

console.log("\n== Rolling baseline region anomalies (threshold 25%) ==");
const rollingAnomalies = detectRollingBaselineAnomalies(salesRows, 0.25);
console.log(`found ${rollingAnomalies.length}`);
console.table(
  rollingAnomalies.map((a) => ({
    region: a.dimensionValue,
    month: a.period,
    observed: Math.round(a.observed),
    baseline: Math.round(a.baseline),
    deviationPct: (a.deviation * 100).toFixed(1) + "%",
  }))
);

console.log("\n== Top SKU performers (anchor month) ==");
if (trends.anchorMonth) {
  const perf = rankPerformers(salesRows, "sku", trends.anchorMonth);
  console.table(perf.slice(0, 5));

  console.log("\n== Risks & opportunities ==");
  const regionPerf = rankPerformers(salesRows, "region", trends.anchorMonth);
  const risks = synthesizeRisksAndOpportunities({
    inventoryRows,
    skuPerformers: perf,
    regionPerformers: regionPerf,
    anomalies: [...skuAnomalies, ...returnAnomalies, ...rollingAnomalies],
  });
  console.log(risks);
}
