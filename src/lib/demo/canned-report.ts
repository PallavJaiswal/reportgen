import "server-only";
import cannedReportJson from "./canned-report.json";
import type { ExecutiveSummaryResult } from "@/lib/ai/types";

type CannedAnomalyExplanation = {
  metricLabel: string;
  dimensionValue: string;
  keywords: string[];
  explanation: string;
};

type CannedQA = {
  question: string;
  keywords: string[];
  answer: string;
};

type CannedReport = {
  generatedAt: string;
  executiveSummary: ExecutiveSummaryResult;
  anomalyExplanations: CannedAnomalyExplanation[];
  qaExamples: CannedQA[];
};

const cannedReport = cannedReportJson as CannedReport;

export const DEMO_LIMIT_MESSAGE =
  "You've used your one free AI-powered analysis for this demo. Here's a sample so you can keep exploring — want the full experience? Fork this project or get in touch.";

export function getCannedExecutiveSummary(): ExecutiveSummaryResult {
  return cannedReport.executiveSummary;
}

/** Best-effort keyword match against the canned anomaly explanations,
 * falling back to the closest available one so the demo never looks empty. */
export function findCannedAnomalyExplanation(metricLabel: string, dimensionValue: string): string {
  const needle = `${metricLabel} ${dimensionValue}`.toLowerCase();
  const match = cannedReport.anomalyExplanations.find((entry) =>
    entry.keywords.some((keyword) => needle.includes(keyword))
  );
  return (match ?? cannedReport.anomalyExplanations[0]).explanation;
}

/** Best-effort keyword match against the canned Q&A examples, falling back
 * to a generic pointer at the executive summary. */
export function findCannedAnswer(question: string): string {
  const needle = question.toLowerCase();
  const match = cannedReport.qaExamples.find((entry) =>
    entry.keywords.some((keyword) => needle.includes(keyword))
  );
  if (match) return match.answer;
  return "This demo can't answer arbitrary questions right now, but the executive summary above covers the period's key performance, anomalies, and recommendations.";
}
