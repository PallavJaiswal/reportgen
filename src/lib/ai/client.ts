import type { AnomalyExplanationContext, ExecutiveSummaryResult, ReportContext } from "./types";

type LimitedFields = { limited?: boolean; limitMessage?: string };

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}

export function requestAnomalyExplanation(
  context: AnomalyExplanationContext
): Promise<{ explanation: string } & LimitedFields> {
  return postJson("/api/ai/explain-anomaly", context);
}

export function requestExecutiveSummary(
  context: ReportContext
): Promise<ExecutiveSummaryResult & LimitedFields> {
  return postJson("/api/ai/executive-summary", context);
}

export function requestAnswer(
  question: string,
  context: ReportContext
): Promise<{ answer: string } & LimitedFields> {
  return postJson("/api/ai/ask", { question, context });
}
