// Runs the real parse -> clean -> stats -> AI pipeline once against the
// sample dataset and saves the output as static JSON. This is what gets
// served to demo visitors once they've used their one free AI analysis
// (project-brief.md §4) — never empty or broken, just not freshly generated.
//
// Run with: npx tsx scripts/generate-canned-demo.mts
// Requires ANTHROPIC_API_KEY in .env.local (loaded manually below, since
// this script runs outside the Next.js process).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import Anthropic from "@anthropic-ai/sdk";

import { DATASET_SCHEMAS, mapColumns, type DatasetType } from "../src/lib/data/schema";
import { dedupeRows, buildCanonicalRows, type CleaningResult } from "../src/lib/data/clean-dataset";
import { computeKpiTrends } from "../src/lib/stats/kpis";
import { detectSkuUnitAnomalies, detectSkuReturnAnomalies, detectRollingBaselineAnomalies } from "../src/lib/stats/anomalies";
import { rankPerformers } from "../src/lib/stats/performers";
import { synthesizeRisksAndOpportunities } from "../src/lib/stats/risks";
import { strField, numField } from "../src/lib/stats/aggregate";
import { formatMonthLabel } from "../src/lib/format";
import { buildReportContext } from "../src/lib/ai/build-report-context";
import {
  buildAnomalyExplanationPrompt,
  buildExecutiveSummaryPrompt,
  buildQuestionPrompt,
  EXECUTIVE_SUMMARY_TOOL,
} from "../src/lib/ai/prompts";
import { coerceExecutiveSummary } from "../src/lib/ai/coerce-executive-summary";
import type { AnomalyExplanationContext, ReportContext } from "../src/lib/ai/types";

// `anthropic-provider.ts` imports "server-only", which throws outside
// Next.js's server bundling — so this standalone script calls the SDK
// directly, reusing the same prompts/schema/coercion the app uses.
const MODEL = "claude-sonnet-5";

async function explainAnomaly(client: Anthropic, context: AnomalyExplanationContext): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: buildAnomalyExplanationPrompt(context) }],
  });
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text.trim() ?? "";
}

async function summarizeExecutive(client: Anthropic, context: ReportContext) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2500,
    messages: [{ role: "user", content: buildExecutiveSummaryPrompt(context) }],
    tools: [EXECUTIVE_SUMMARY_TOOL],
    tool_choice: { type: "tool", name: EXECUTIVE_SUMMARY_TOOL.name },
  });
  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("Model did not return a structured executive summary.");
  return coerceExecutiveSummary(toolUse.input);
}

async function answerQuestion(client: Anthropic, question: string, context: ReportContext): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: buildQuestionPrompt(question, context) }],
  });
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block?.text.trim() ?? "";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// --- Load .env.local manually (this script runs outside Next.js) ---------
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvLocal();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY not found in .env.local — needed to generate canned demo content.");
}

const DATA_DIR = path.join(ROOT, "public", "sample-data");
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

  const reportContext = buildReportContext({
    periodLabel: formatMonthLabel(anchorMonth),
    kpiRows: kpiTrends.rows,
    anomalies,
    skuPerformers,
    risks,
    actionedRecommendations: [],
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  console.log("Generating executive summary...");
  const executiveSummary = await summarizeExecutive(client, reportContext);

  console.log("Generating anomaly explanations...");
  // Deviation isn't comparable across methods/metrics (a z-score of 7 vs. a
  // -74% rolling-baseline swing), so a flat top-5 by |deviation| let SKU
  // unit-spikes crowd out the more narratively important regional collapse
  // and the returns defect wave. Pick the strongest from each bucket instead.
  const byMetric = new Map<string, typeof anomalies>();
  for (const anomaly of anomalies) {
    const list = byMetric.get(anomaly.metricLabel) ?? [];
    list.push(anomaly);
    byMetric.set(anomaly.metricLabel, list);
  }
  const pickedAnomalies = [
    ...(byMetric.get("Monthly revenue") ?? []).slice(0, 2),
    ...(byMetric.get("Weekly units sold") ?? []).slice(0, 2),
    ...(byMetric.get("Monthly returned units") ?? []).slice(0, 1),
  ].slice(0, 5);
  const anomalyExplanations = [];
  for (const anomaly of pickedAnomalies) {
    const explanation = await explainAnomaly(client, {
      metricLabel: anomaly.metricLabel,
      dimensionType: anomaly.dimensionType,
      dimensionValue: anomaly.dimensionValue,
      period: `${anomaly.periodLabel} ${anomaly.period}`,
      observed: anomaly.observed,
      baseline: anomaly.baseline,
      method: anomaly.method,
      threshold: anomaly.threshold,
      direction: anomaly.direction,
      sampleRows: anomaly.sourceRows,
    });
    anomalyExplanations.push({
      metricLabel: anomaly.metricLabel,
      dimensionValue: anomaly.dimensionValue,
      keywords: [anomaly.dimensionValue.toLowerCase(), anomaly.metricLabel.toLowerCase()],
      explanation,
    });
    console.log(`  - ${anomaly.metricLabel} / ${anomaly.dimensionValue}`);
  }

  console.log("Generating Q&A examples...");
  const questions = [
    { question: "Why did the East region underperform?", keywords: ["east", "region"] },
    { question: "Which SKU is growing the fastest?", keywords: ["sku", "growing", "fastest", "top", "performer"] },
    { question: "Are there any inventory risks?", keywords: ["inventory", "stock", "stockout", "reorder"] },
    { question: "What's driving the return rate?", keywords: ["return", "returns", "defect"] },
  ];
  const qaExamples = [];
  for (const q of questions) {
    const answer = await answerQuestion(client, q.question, reportContext);
    qaExamples.push({ question: q.question, keywords: q.keywords, answer });
    console.log(`  - ${q.question}`);
  }

  const cannedReport = {
    generatedAt: new Date().toISOString(),
    executiveSummary,
    anomalyExplanations,
    qaExamples,
  };

  const outPath = path.join(ROOT, "src", "lib", "demo", "canned-report.json");
  writeFileSync(outPath, JSON.stringify(cannedReport, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
