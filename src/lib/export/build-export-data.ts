import type { CanonicalRow, CleaningResult } from "@/lib/data/clean-dataset";
import type { DatasetKey } from "@/lib/store/report-store";
import type { KpiTrendRow } from "@/lib/stats/kpis";
import type { Anomaly } from "@/lib/stats/anomalies";
import type { PerformerRow } from "@/lib/stats/performers";
import type { RiskOpportunity } from "@/lib/stats/risks";
import type { ExecutiveSummaryResult, ExecutiveSummarySection } from "@/lib/ai/types";
import { formatKpiValue, formatDeltaPct } from "@/lib/format";

export type ExportKpiRow = { label: string; current: string; mom: string; qoq: string; yoy: string };
export type ExportAnomalyRow = {
  metricLabel: string;
  dimensionValue: string;
  period: string;
  observed: string;
  baseline: string;
  deviation: string;
  method: string;
  severity: string;
};
export type ExportPerformerRow = { dimensionValue: string; revenue: string; trend: string };
export type ExportRecommendation = { title: string; detail: string; relatedKpi: string; actioned: boolean };

export type ExportData = {
  generatedAtLabel: string;
  periodLabel: string;
  comparisonLabel: string;
  /** Set when the source data contained more than one currency — every
   * monetary figure in this export is scoped to this one currency only. */
  currencyScopeNote: string | null;
  /** Set when a channel filter is active — Returns has no channel field, so
   * return rate/refunds still reflect every channel even while everything
   * else is scoped to one. */
  channelScopeNote: string | null;
  contextNotes: string[];
  kpis: ExportKpiRow[];
  headline: string;
  sections: ExecutiveSummarySection[];
  recommendations: ExportRecommendation[];
  risks: RiskOpportunity[];
  anomalies: ExportAnomalyRow[];
  topPerformers: ExportPerformerRow[];
  bottomPerformers: ExportPerformerRow[];
  datasets: Partial<Record<DatasetKey, { label: string; rows: CanonicalRow[] }>>;
};

const DATASET_LABELS: Record<DatasetKey, string> = {
  sales: "Sales",
  orders: "Orders",
  inventory: "Inventory",
  returns: "Returns",
};

function formatDeviation(a: Anomaly): string {
  if (a.method === "zscore") return `z = ${a.deviation.toFixed(1)}`;
  if (a.method === "iqr") return `${a.deviation.toFixed(1)}x IQR`;
  return `${a.deviation > 0 ? "+" : ""}${(a.deviation * 100).toFixed(0)}% vs. trailing avg`;
}

export function buildExportData(params: {
  periodLabel: string;
  comparisonLabel: string;
  kpiRows: KpiTrendRow[];
  anomalies: Anomaly[];
  topPerformers: PerformerRow[];
  bottomPerformers: PerformerRow[];
  risks: RiskOpportunity[];
  executiveSummary: ExecutiveSummaryResult | null;
  actionedRecommendations: string[];
  cleaningResults: Partial<Record<DatasetKey, CleaningResult>>;
  availableCurrencies?: string[];
  reportingCurrency?: string | null;
  contextNotes?: string[];
  channelFilter?: string | null;
}): ExportData {
  const datasets: ExportData["datasets"] = {};
  for (const key of Object.keys(params.cleaningResults) as DatasetKey[]) {
    const result = params.cleaningResults[key];
    if (result) datasets[key] = { label: DATASET_LABELS[key], rows: result.rows };
  }
  const currencyCode = params.reportingCurrency ?? "USD";

  return {
    generatedAtLabel: new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    periodLabel: params.periodLabel,
    comparisonLabel: params.comparisonLabel,
    currencyScopeNote:
      params.availableCurrencies && params.availableCurrencies.length > 1
        ? `This data contains multiple currencies (${params.availableCurrencies.join(", ")}). All monetary figures in this report are scoped to ${currencyCode} only — amounts in other currencies are excluded, never blended in.`
        : null,
    channelScopeNote: params.channelFilter
      ? `Filtered to the "${params.channelFilter}" channel only. Return rate still reflects all channels combined — the Returns data in this upload has no channel field.`
      : null,
    contextNotes: params.contextNotes ?? [],
    kpis: params.kpiRows.map((k) => ({
      label: k.label,
      current: formatKpiValue(k.current, k.format, currencyCode),
      mom: formatDeltaPct(k.mom),
      qoq: formatDeltaPct(k.qoq),
      yoy: formatDeltaPct(k.yoy),
    })),
    headline:
      params.executiveSummary?.headline ??
      "No executive summary has been generated yet — generate one on the Summary page first.",
    sections: params.executiveSummary?.sections ?? [],
    recommendations: (params.executiveSummary?.recommendations ?? []).map((r) => ({
      ...r,
      actioned: params.actionedRecommendations.includes(r.title),
    })),
    risks: params.risks,
    anomalies: params.anomalies.slice(0, 15).map((a) => ({
      metricLabel: a.metricLabel,
      dimensionValue: a.dimensionValue,
      period: `${a.periodLabel} ${a.period}`,
      observed: Math.round(a.observed).toLocaleString(),
      baseline: Math.round(a.baseline).toLocaleString(),
      deviation: formatDeviation(a),
      method: a.method,
      severity: a.severity,
    })),
    topPerformers: params.topPerformers.map((p) => ({
      dimensionValue: p.dimensionValue,
      revenue: formatKpiValue(p.current, "currency", currencyCode),
      trend: `${formatDeltaPct(p.deltaPct)} ${params.comparisonLabel}`,
    })),
    bottomPerformers: params.bottomPerformers.map((p) => ({
      dimensionValue: p.dimensionValue,
      revenue: formatKpiValue(p.current, "currency", currencyCode),
      trend: `${formatDeltaPct(p.deltaPct)} ${params.comparisonLabel}`,
    })),
    datasets,
  };
}
