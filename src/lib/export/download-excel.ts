import * as XLSX from "xlsx";
import type { ExportData } from "./build-export-data";

export function downloadExcelReport(data: ExportData): void {
  const workbook = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["Business Performance Report"],
    ["Reporting period", data.periodLabel],
    ["Generated", data.generatedAtLabel],
    ...(data.currencyScopeNote ? [[], ["Currency scope", data.currencyScopeNote]] : []),
    ...(data.channelScopeNote ? [[], ["Channel scope", data.channelScopeNote]] : []),
    ...(data.contextNotes.length > 0
      ? [[], ["Business context"], ...data.contextNotes.map((note) => ["", note])]
      : []),
    [],
    ["Headline"],
    [data.headline],
    [],
    ...data.sections.flatMap((section) => [
      [section.heading],
      ...section.bullets.map((bullet) => ["", bullet]),
      [],
    ]),
    ["KPI", "Current", data.comparisonLabel, "QoQ", "YoY"],
    ...data.kpis.map((k) => [k.label, k.current, k.mom, k.qoq, k.yoy]),
    [],
    ["Recommended Actions"],
    ["Title", "Detail", "Related KPI", "Actioned"],
    ...data.recommendations.map((r) => [r.title, r.detail, r.relatedKpi, r.actioned ? "Yes" : "No"]),
    [],
    ["Risks & Opportunities"],
    ["Type", "Title", "Detail"],
    ...data.risks.map((r) => [r.type, r.title, r.detail]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  const anomalyRows = [
    ["Metric", "Dimension", "Period", "Observed", "Baseline", "Deviation", "Method", "Severity"],
    ...data.anomalies.map((a) => [
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

  const performerRows: (string | number)[][] = [
    ["Top Performers"],
    ["SKU", "Revenue", "Trend"],
    ...data.topPerformers.map((p) => [p.dimensionValue, p.revenue, p.trend]),
    [],
    ["Bottom Performers"],
    ["SKU", "Revenue", "Trend"],
    ...data.bottomPerformers.map((p) => [p.dimensionValue, p.revenue, p.trend]),
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(performerRows), "Performers");

  for (const key of Object.keys(data.datasets) as (keyof typeof data.datasets)[]) {
    const dataset = data.datasets[key];
    if (!dataset || dataset.rows.length === 0) continue;
    const sheet = XLSX.utils.json_to_sheet(dataset.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, dataset.label);
  }

  const filename = `business-report-${data.periodLabel.replace(/\s+/g, "-").toLowerCase()}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
