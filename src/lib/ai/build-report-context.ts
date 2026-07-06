import type { KpiTrendRow } from "@/lib/stats/kpis";
import type { Anomaly } from "@/lib/stats/anomalies";
import type { PerformerRow } from "@/lib/stats/performers";
import type { RiskOpportunity } from "@/lib/stats/risks";
import { formatKpiValue, formatDeltaPct, formatCurrency } from "@/lib/format";
import type { ReportContext } from "./types";

export function buildReportContext(params: {
  periodLabel: string;
  comparisonLabel?: string;
  kpiRows: KpiTrendRow[];
  anomalies: Anomaly[];
  skuPerformers: PerformerRow[];
  risks: RiskOpportunity[];
  actionedRecommendations: string[];
  reportingCurrency?: string | null;
  contextNotes?: string[];
}): ReportContext {
  const currencyCode = params.reportingCurrency ?? "USD";
  const comparisonLabel = params.comparisonLabel ?? "MoM";
  const sortedPerformers = [...params.skuPerformers].sort((a, b) => b.current - a.current);
  const top = sortedPerformers.slice(0, 5);
  const bottom = [...sortedPerformers].reverse().slice(0, 5);

  return {
    periodLabel: params.periodLabel,
    kpis: params.kpiRows.map((k) => ({
      label: k.label,
      current: formatKpiValue(k.current, k.format, currencyCode),
      mom: formatDeltaPct(k.mom),
      qoq: formatDeltaPct(k.qoq),
      yoy: formatDeltaPct(k.yoy),
    })),
    topAnomalies: params.anomalies.slice(0, 8).map((a) => ({
      summary: `${a.metricLabel} for ${a.dimensionValue} was ${a.direction} baseline ${a.periodLabel} ${a.period} (observed ${Math.round(a.observed).toLocaleString()} vs. expected ~${Math.round(a.baseline).toLocaleString()}, ${a.method} method).`,
    })),
    topPerformers: top.map((p) => ({
      dimension: "SKU",
      label: p.dimensionValue,
      revenue: formatCurrency(p.current, currencyCode),
      trend: `${formatDeltaPct(p.deltaPct)} ${comparisonLabel}`,
    })),
    bottomPerformers: bottom.map((p) => ({
      dimension: "SKU",
      label: p.dimensionValue,
      revenue: formatCurrency(p.current, currencyCode),
      trend: `${formatDeltaPct(p.deltaPct)} ${comparisonLabel}`,
    })),
    risks: params.risks,
    // This list is persisted indefinitely in localStorage and only ever
    // grows across sessions — cap it so a long testing/usage history can't
    // silently balloon the prompt (and push the model's response past its
    // token budget on every subsequent regeneration).
    actionedRecommendations: params.actionedRecommendations.slice(-8),
    reportingCurrency: params.reportingCurrency ?? null,
    contextNotes: params.contextNotes ?? [],
  };
}
