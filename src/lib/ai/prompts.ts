import type { AnomalyExplanationContext, ReportContext } from "./types";

export function buildAnomalyExplanationPrompt(ctx: AnomalyExplanationContext): string {
  return `You are a business analyst explaining a statistically-detected anomaly to an executive audience.

Anomaly detected:
- Metric: ${ctx.metricLabel}
- Dimension: ${ctx.dimensionType} = ${ctx.dimensionValue}
- Period: ${ctx.period}
- Observed value: ${ctx.observed}
- Expected baseline: ${ctx.baseline}
- Detection method: ${ctx.method} (threshold ${ctx.threshold})
- Direction: ${ctx.direction} baseline

A sample of the underlying rows driving this anomaly (JSON):
${JSON.stringify(ctx.sampleRows.slice(0, 8), null, 2)}
${
  ctx.contextNotes && ctx.contextNotes.length > 0
    ? `\nBusiness context provided by the user — use this to explain the anomaly when plausible, but never invent a causal link it doesn't support:\n${ctx.contextNotes.map((n) => `- ${n}`).join("\n")}`
    : ""
}

Write a concise (3-5 sentence) plain-language explanation of what likely happened and why it matters for the business. Ground your explanation in the actual row data above — reference concrete details (specific SKUs, regions, reasons, dates) rather than generic statements. Do not repeat the raw numbers verbatim; interpret them. Do not use markdown formatting.`;
}

function formatKpiList(ctx: ReportContext): string {
  return ctx.kpis
    .map((k) => `- ${k.label}: ${k.current} (MoM ${k.mom}, QoQ ${k.qoq}, YoY ${k.yoy})`)
    .join("\n");
}

function formatPerformerList(performers: ReportContext["topPerformers"]): string {
  return performers.map((p) => `- ${p.dimension} ${p.label}: ${p.revenue} revenue, ${p.trend}`).join("\n") || "- N/A";
}

function formatRiskList(ctx: ReportContext): string {
  return ctx.risks.map((r) => `- [${r.type}] ${r.title}: ${r.detail}`).join("\n") || "- None flagged";
}

function formatAnomalyList(ctx: ReportContext): string {
  return ctx.topAnomalies.map((a) => `- ${a.summary}`).join("\n") || "- None detected";
}

function formatContextNotesBlock(ctx: ReportContext): string {
  if (ctx.contextNotes.length === 0) return "";
  return `\nBusiness context provided by the user — use these to explain trends/anomalies above when plausible, but never invent a causal link a note doesn't support:\n${ctx.contextNotes.map((n) => `- ${n}`).join("\n")}\n`;
}

export function buildExecutiveSummaryPrompt(ctx: ReportContext): string {
  return `You are a business analyst writing the executive summary section of a management report.

Reporting period: ${ctx.periodLabel}
${ctx.reportingCurrency ? `Reporting currency: ${ctx.reportingCurrency}. The uploaded data contained more than one currency; every figure below is already filtered to ${ctx.reportingCurrency} only, so state monetary figures with full confidence — do not caveat them as approximate or mixed.` : ""}

KPIs (current value, and change vs. month/quarter/year prior):
${formatKpiList(ctx)}

Top anomalies detected:
${formatAnomalyList(ctx)}

Top performers:
${formatPerformerList(ctx.topPerformers)}

Bottom performers:
${formatPerformerList(ctx.bottomPerformers)}

Risks & opportunities already flagged:
${formatRiskList(ctx)}
${
  ctx.actionedRecommendations.length > 0
    ? `\nRecommendations already marked as actioned from a previous report run (do not repeat these as new recommendations, but you may reference progress against them):\n${ctx.actionedRecommendations.map((a) => `- ${a}`).join("\n")}`
    : ""
}
${formatContextNotesBlock(ctx)}
Write:
1. A one-sentence headline capturing the single most important takeaway this period.
2. 3-4 sections (e.g. "Performance overview", "Key anomalies & root causes", "Risks & opportunities", "Outlook"), each with 2-5 short bullet points — one concrete fact or insight per bullet, plain language, no sub-bullets, no markdown syntax.
3. 3-5 recommended actions, each tied to a specific KPI or anomaly above (not generic advice), with a one-sentence justification.

Keep every bullet a single sentence. Do not write paragraphs anywhere — this report is read by executives scanning quickly, not reading prose.`;
}

export function buildQuestionPrompt(question: string, ctx: ReportContext): string {
  return `You are answering a natural-language question about a business report, using only the data below. If the data doesn't contain the answer, say so plainly rather than guessing.

Reporting period: ${ctx.periodLabel}
${ctx.reportingCurrency ? `Reporting currency: ${ctx.reportingCurrency}. The uploaded data contained more than one currency; every figure below is already filtered to ${ctx.reportingCurrency} only, so state monetary figures with full confidence.` : ""}

KPIs:
${formatKpiList(ctx)}

Anomalies:
${formatAnomalyList(ctx)}

Top performers:
${formatPerformerList(ctx.topPerformers)}

Bottom performers:
${formatPerformerList(ctx.bottomPerformers)}

Risks & opportunities:
${formatRiskList(ctx)}
${formatContextNotesBlock(ctx)}
Question: ${question}

Answer in 2-4 sentences, plain language, no markdown.`;
}

export const EXECUTIVE_SUMMARY_JSON_SCHEMA_DESCRIPTION = `Respond with ONLY a valid JSON object (no markdown fences, no commentary) matching exactly this shape:
{
  "headline": "string, one sentence — the single most important takeaway this period",
  "sections": [
    { "heading": "string, short section title (e.g. Performance overview)", "bullets": ["string, one sentence per bullet", "..."] }
  ],
  "recommendations": [
    { "title": "string, imperative and specific", "detail": "string, one sentence justification", "relatedKpi": "string, the KPI or metric name this ties to" }
  ]
}
Include 3 to 4 sections, each with 2 to 5 bullets. Include 3 to 5 items in recommendations. Never write paragraphs — every bullet is a single, scannable sentence.`;

export const EXECUTIVE_SUMMARY_TOOL = {
  name: "provide_executive_summary",
  description: "Provide the structured executive summary and recommended actions.",
  input_schema: {
    type: "object" as const,
    properties: {
      headline: {
        type: "string",
        description: "One sentence — the single most important takeaway this period.",
      },
      sections: {
        type: "array",
        description:
          "3 to 4 sections (e.g. Performance overview, Key anomalies & root causes, Risks & opportunities, Outlook), each with 2-5 short bullet points.",
        items: {
          type: "object",
          properties: {
            heading: { type: "string", description: "Short section title." },
            bullets: {
              type: "array",
              description: "One concrete fact or insight per bullet, plain language, single sentence each.",
              items: { type: "string" },
            },
          },
          required: ["heading", "bullets"],
        },
      },
      recommendations: {
        type: "array",
        description: "Exactly 3 to 5 recommended actions.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Imperative and specific." },
            detail: { type: "string", description: "One sentence justification." },
            relatedKpi: { type: "string", description: "The KPI or metric name this ties to." },
          },
          required: ["title", "detail", "relatedKpi"],
        },
      },
    },
    required: ["headline", "sections", "recommendations"],
  },
};
