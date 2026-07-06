// One-off sanity check that the PDF/Excel export pipeline actually produces
// valid, non-empty output from real sample data — not a substitute for
// clicking the buttons in a browser, just a check that the generation logic
// itself doesn't throw and produces something real.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { renderToBuffer } from "@react-pdf/renderer";

import { DATASET_SCHEMAS, mapColumns, type DatasetType } from "../src/lib/data/schema";
import { dedupeRows, buildCanonicalRows, type CleaningResult } from "../src/lib/data/clean-dataset";
import { computeKpiTrends } from "../src/lib/stats/kpis";
import { detectSkuUnitAnomalies, detectSkuReturnAnomalies, detectRollingBaselineAnomalies } from "../src/lib/stats/anomalies";
import { rankPerformers } from "../src/lib/stats/performers";
import { synthesizeRisksAndOpportunities } from "../src/lib/stats/risks";
import { strField, numField } from "../src/lib/stats/aggregate";
import { formatMonthLabel } from "../src/lib/format";
import { buildExportData } from "../src/lib/export/build-export-data";
import { PdfReportDocument } from "../src/lib/export/pdf-document";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "sample-data");
const OUT_DIR =
  process.env.EXPORT_TEST_OUT_DIR ??
  "C:/Users/Pallav/AppData/Local/Temp/claude/c--Users-Pallav-Documents-Ecommerce-Automations-business-report-generator/09c34ecc-1501-414d-847e-930435031679/scratchpad";

const FILES: Record<DatasetType, string> = {
  sales: "sample-sales.csv",
  orders: "sample-orders.csv",
  inventory: "sample-inventory.csv",
  returns: "sample-returns.csv",
};

async function main() {
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

  const kpiTrends = computeKpiTrends({ salesRows, ordersRows, returnsRows, unitCostBySku });
  const anomalies = [
    ...detectSkuUnitAnomalies(salesRows, "zscore", 2.5),
    ...detectSkuReturnAnomalies(returnsRows, "zscore", 2.5),
    ...detectRollingBaselineAnomalies(salesRows, 0.25),
  ].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  const anchorMonth = kpiTrends.anchorMonth!;
  const skuPerformers = rankPerformers(salesRows, "sku", anchorMonth);
  const regionPerformers = rankPerformers(salesRows, "region", anchorMonth);
  const risks = synthesizeRisksAndOpportunities({
    inventoryRows,
    skuPerformers,
    regionPerformers,
    anomalies,
  });

  const exportData = buildExportData({
    periodLabel: formatMonthLabel(anchorMonth),
    comparisonLabel: "MoM",
    kpiRows: kpiTrends.rows,
    anomalies,
    topPerformers: skuPerformers.slice(0, 5),
    bottomPerformers: [...skuPerformers].reverse().slice(0, 5),
    risks,
    executiveSummary: {
      headline: "Placeholder headline to confirm rendering works.",
      sections: [
        {
          heading: "Performance overview",
          bullets: ["Placeholder bullet one.", "Placeholder bullet two."],
        },
      ],
      recommendations: [
        { title: "Sample recommendation", detail: "Sample detail justification.", relatedKpi: "Total revenue" },
      ],
    },
    actionedRecommendations: [],
    cleaningResults: results,
  });

  console.log("Rendering PDF...");
  const pdfBuffer = await renderToBuffer(PdfReportDocument({ data: exportData }));
  const pdfPath = path.join(OUT_DIR, "test-report.pdf");
  writeFileSync(pdfPath, pdfBuffer);
  console.log(`  wrote ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  console.log("Building Excel workbook...");
  const workbook = XLSX.utils.book_new();
  const summaryRows: (string | number)[][] = [
    ["Business Performance Report"],
    ["Reporting period", exportData.periodLabel],
    ["Generated", exportData.generatedAtLabel],
    [],
    ["KPI", "Current", "MoM", "QoQ", "YoY"],
    ...exportData.kpis.map((k) => [k.label, k.current, k.mom, k.qoq, k.yoy]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");
  const anomalyRows = [
    ["Metric", "Dimension", "Period", "Observed", "Baseline", "Deviation", "Method", "Severity"],
    ...exportData.anomalies.map((a) => [
      a.metricLabel,
      a.dimensionValue,
      a.period,
      a.observed,
      a.baseline,
      a.deviation,
      a.method,
      a.severity,
    ]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(anomalyRows), "Anomalies");
  for (const key of Object.keys(exportData.datasets) as (keyof typeof exportData.datasets)[]) {
    const dataset = exportData.datasets[key];
    if (!dataset || dataset.rows.length === 0) continue;
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dataset.rows), dataset.label);
  }
  const excelPath = path.join(OUT_DIR, "test-report.xlsx");
  XLSX.writeFile(workbook, excelPath);
  console.log(`  wrote ${excelPath}`);
  console.log(`  sheets: ${workbook.SheetNames.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
