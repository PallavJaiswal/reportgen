export type RecommendedAction = {
  title: string;
  detail: string;
  relatedKpi: string;
};

export type ExecutiveSummarySection = {
  heading: string;
  bullets: string[];
};

export type ExecutiveSummaryResult = {
  headline: string;
  sections: ExecutiveSummarySection[];
  recommendations: RecommendedAction[];
};

export type AnomalyExplanationContext = {
  metricLabel: string;
  dimensionType: string;
  dimensionValue: string;
  period: string;
  observed: number;
  baseline: number;
  method: string;
  threshold: number;
  direction: "above" | "below";
  sampleRows: Record<string, unknown>[];
  /** User-provided or AI-suggested business context (e.g. "Prime Day ran
   * 12-15 May") — used to explain this anomaly against real events instead
   * of guessing blindly. */
  contextNotes?: string[];
};

export type ReportKpiContext = {
  label: string;
  current: string;
  mom: string;
  qoq: string;
  yoy: string;
};

export type ReportPerformerContext = {
  dimension: string;
  label: string;
  revenue: string;
  trend: string;
};

export type ReportRiskContext = {
  type: "risk" | "opportunity";
  title: string;
  detail: string;
};

export type ReportContext = {
  /** Human-readable reporting window, e.g. "Jun 2026" or "May 1 - May 31,
   * 2025" — always accurate regardless of whether the report is anchored to
   * a calendar month or an arbitrary custom range (unlike a raw month key,
   * which is null whenever a non-month range is selected). */
  periodLabel: string;
  kpis: ReportKpiContext[];
  topAnomalies: { summary: string }[];
  topPerformers: ReportPerformerContext[];
  bottomPerformers: ReportPerformerContext[];
  risks: ReportRiskContext[];
  actionedRecommendations: string[];
  /** The currency all monetary figures in this context are scoped to. Null
   * means the data has no currency ambiguity (single currency, or no
   * currency column at all). All figures are already filtered to this one
   * currency before reaching the model — never a blended multi-currency sum. */
  reportingCurrency: string | null;
  /** Business-context notes the user typed in (or accepted an AI guess for)
   * — e.g. "12-15 May 2026 was a Prime Day promotion." The model should use
   * these to explain trends/anomalies when plausible, and never fabricate a
   * causal link a note doesn't support. */
  contextNotes: string[];
};

export interface AIProvider {
  explainAnomaly(context: AnomalyExplanationContext): Promise<string>;
  summarizeExecutive(context: ReportContext): Promise<ExecutiveSummaryResult>;
  answerQuestion(question: string, context: ReportContext): Promise<string>;
}
